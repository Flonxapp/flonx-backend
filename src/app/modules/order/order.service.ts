/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import config from '../../config';
import AppError from '../../error/appError';
import { ENUM_PAYMENT_PURPOSE } from '../../utilities/enum';
import stripe from '../../utilities/stripe';
import Cart from '../cart/cart.model';

import { JwtPayload } from 'jsonwebtoken';
import { errorLogger } from '../../shared/logger';
import { Customer } from '../Customer/customer.model';
import {
  ENUM_NOTIFICATION_TYPE,
  NOTIFICATION_ACTION,
  NOTIFICATION_ENTITY,
} from '../notification/notification.enum';
import NotificationService from '../notification/notification.services';
import { ENUM_SHIFT_STATUS } from '../shift/shift.enum';
import { Shift } from '../shift/shift.model';
import { USER_ROLE } from '../user/user.constant';
import OrderRefundService from './order.refund.service';
import { ENUM_ORDER_STATUS } from './order.enum';
import { Order } from './order.model';
const generateOrderCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const firstChar = letters.charAt(Math.floor(Math.random() * letters.length));
  const digits = Math.floor(10 + Math.random() * 90); // 10-99

  return `${firstChar}${digits}`;
};

// The order is saved before Stripe is called, so the payment webhook can
// always find it (a saved card can be charged before this function returns).
const createOrder = async (customerId: string, paymentMethodId?: string) => {
  const cart: any = await Cart.findOne({ customer: customerId })
    .populate('items.product', 'name isAvailable')
    .populate('customer', 'name email stripeCustomerId');

  if (!cart || cart.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
  }

  cart.items.forEach((item: any) => {
    if (!item.product?.isAvailable) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `${item.product?.name || 'A product'} is not available right now, please remove it from cart to proceed`,
      );
    }
  });

  const openOrders = await Order.countDocuments({
    venue: cart.venue,
    status: { $in: [ENUM_ORDER_STATUS.QUEUED, ENUM_ORDER_STATUS.IN_PROGRESS] },
  });
  if (openOrders >= config.app.max_concurrent_orders) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      'The bar is very busy right now. Please try again in a few minutes.',
    );
  }

  const now = new Date();
  const availableShift = await Shift.findOne({
    venue: cart.venue,
    status: ENUM_SHIFT_STATUS.Active,
    startDateTime: { $lte: now },
    endDateTime: { $gte: now },
  });
  if (!availableShift) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No bartender available right now',
    );
  }

  const order: any = await Order.create({
    customer: cart.customer._id,
    venue: cart.venue,
    venueOwner: cart.venueOwner,
    bartender: availableShift.bartender,
    shift: availableShift._id,
    items: cart.items,
    totalQuantity: cart.totalQuantity,
    subTotal: cart.subTotal,
    deliveryFee: 0,
    totalPrice: cart.totalPrice,
    status: ENUM_ORDER_STATUS.PENDING,
    orderCode: generateOrderCode(),
  });

  try {
    let stripeCustomerId = cart.customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create(
        { name: cart.customer.name, email: cart.customer.email },
        { idempotencyKey: `customer-${cart.customer._id.toString()}` },
      );
      stripeCustomerId = stripeCustomer.id;
      await Customer.findByIdAndUpdate(cart.customer._id, {
        stripeCustomerId,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(order.totalPrice * 100),
        currency: 'usd',
        customer: stripeCustomerId,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        ...(paymentMethodId && {
          payment_method: paymentMethodId,
          confirm: true,
        }),
        ...(!paymentMethodId && {
          setup_future_usage: 'off_session',
        }),
        metadata: {
          orderId: order._id.toString(),
          paymentPurpose: ENUM_PAYMENT_PURPOSE.ORDER,
          isSavedCardUsed: paymentMethodId ? 1 : 0,
        },
      },
      { idempotencyKey: `order-payment-${order._id.toString()}` },
    );

    // keep the id so an abandoned payment can be cancelled later
    await Order.updateOne(
      { _id: order._id, status: ENUM_ORDER_STATUS.PENDING },
      { paymentIntentId: paymentIntent.id },
    );

    return {
      orderId: order._id,
      clientSecret: paymentIntent.client_secret,
      stripeCustomerId,
      bartender: availableShift.bartender,
      paymentIntentId: paymentIntent.id,
      paymentMethodId,
    };
  } catch (error: any) {
    await Order.updateOne(
      { _id: order._id, status: ENUM_ORDER_STATUS.PENDING },
      {
        status: ENUM_ORDER_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: 'Payment could not be started',
      },
    );
    if (error?.type === 'StripeCardError') {
      throw new AppError(
        httpStatus.PAYMENT_REQUIRED,
        error.message || 'Your card was declined',
      );
    }
    throw error;
  }
};

const getMyOrders = async (
  profileId: string,
  query: Record<string, unknown>,
) => {
  const andConditions: any[] = [];

  andConditions.push({
    $or: [
      { customer: profileId },
      { venueOwner: profileId },
      { bartender: profileId },
    ],
    status: { $ne: ENUM_ORDER_STATUS.PENDING },
  });

  if (query.status == 'PAST_ORDER') {
    andConditions.push({
      status: {
        $in: [ENUM_ORDER_STATUS.PICKED, ENUM_ORDER_STATUS.CANCELLED],
      },
    });

    delete query.status;
  }

  if (query.status == 'CURRENT_ORDER') {
    andConditions.push({
      status: {
        $in: [
          ENUM_ORDER_STATUS.QUEUED,
          ENUM_ORDER_STATUS.IN_PROGRESS,
          ENUM_ORDER_STATUS.READY_FOR_PIC,
        ],
      },
    });

    delete query.status;
  }

  if (query.status) {
    andConditions.push({
      status: query.status,
    });
  }

  const orderQuery = new QueryBuilder(
    Order.find({
      $and: andConditions,
    }).populate({
      path: 'items.product',
      select: 'name image price',
    }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await orderQuery.modelQuery;
  const meta = await orderQuery.countTotal();

  return {
    meta,
    result,
  };
};
const getAllOrder = async (query: Record<string, unknown>) => {
  const andConditions: any[] = [];

  andConditions.push({
    status: { $ne: ENUM_ORDER_STATUS.PENDING },
  });

  if (query.status == 'PAST_ORDER') {
    andConditions.push({
      status: {
        $in: [ENUM_ORDER_STATUS.PICKED, ENUM_ORDER_STATUS.CANCELLED],
      },
    });

    delete query.status;
  }

  if (query.status == 'CURRENT_ORDER') {
    andConditions.push({
      status: {
        $in: [
          ENUM_ORDER_STATUS.QUEUED,
          ENUM_ORDER_STATUS.IN_PROGRESS,
          ENUM_ORDER_STATUS.READY_FOR_PIC,
        ],
      },
    });

    delete query.status;
  }

  if (query.status) {
    andConditions.push({
      status: query.status,
    });
  }

  const orderQuery = new QueryBuilder(
    Order.find({
      $and: andConditions,
    }).populate({
      path: 'items.product',
      select: 'name image price',
    }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await orderQuery.modelQuery;
  const meta = await orderQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getSingleOrder = async (profileId: string, orderId: string) => {
  const order = await Order.findOne({
    _id: orderId,
    $or: [
      { customer: profileId },
      { venueOwner: profileId },
      { bartender: profileId },
    ],
  })
    .populate({
      path: 'items.product',
      select: 'name image price',
    })
    .populate({
      path: 'venue',
      select: 'name location address logo',
    });

  if (!order) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Order not found or access denied',
    );
  }

  return order;
};

// bartender: item unavailable
const markAsUnavailableAndRefund = async (
  userData: JwtPayload,
  orderId: string,
) =>
  OrderRefundService.cancelOrderAndRefund(
    userData,
    orderId,
    'Item unavailable',
  );

const cancelOrder = async (
  userData: JwtPayload,
  orderId: string,
  reason?: string,
) => OrderRefundService.cancelOrderAndRefund(userData, orderId, reason);

const FINAL_OR_UNPAID_STATUSES = [
  ENUM_ORDER_STATUS.PENDING,
  ENUM_ORDER_STATUS.CANCELLED,
  ENUM_ORDER_STATUS.PICKED,
];

const changeOrderStatus = async (
  userData: JwtPayload,
  orderId: string,
  status: string,
) => {
  // cancel always goes through the refund flow
  if (status === ENUM_ORDER_STATUS.CANCELLED) {
    return OrderRefundService.cancelOrderAndRefund(userData, orderId);
  }

  const isCustomer = userData.role === USER_ROLE.customer;
  const allowedTargets = isCustomer
    ? [ENUM_ORDER_STATUS.PICKED]
    : [
        ENUM_ORDER_STATUS.IN_PROGRESS,
        ENUM_ORDER_STATUS.READY_FOR_PIC,
        ENUM_ORDER_STATUS.PICKED,
      ];
  if (!allowedTargets.includes(status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      isCustomer
        ? 'Customer can only mark order as picked'
        : `Invalid order status: ${status}`,
    );
  }

  const order = await Order.findOne({
    _id: orderId,
    ...(isCustomer
      ? { customer: userData.profileId }
      : { bartender: userData.profileId }),
  });

  if (!order) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Order not found or access denied',
    );
  }

  if (FINAL_OR_UNPAID_STATUSES.includes(order.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      order.status === ENUM_ORDER_STATUS.PENDING
        ? 'This order has not been paid'
        : `This order is already ${order.status.toLowerCase()}`,
    );
  }

  // only if the status hasn't changed meanwhile
  const result = await Order.findOneAndUpdate(
    { _id: orderId, status: order.status },
    { status },
    { new: true, runValidators: true },
  );
  if (!result) {
    throw new AppError(
      httpStatus.CONFLICT,
      'The order status just changed. Please refresh and try again.',
    );
  }

  const receiver =
    userData.role === USER_ROLE.customer ? result?.bartender : result?.customer;

  const isFinalStatus =
    status === ENUM_ORDER_STATUS.CANCELLED ||
    status === ENUM_ORDER_STATUS.PICKED;

  NotificationService.sendNotification({
    receiver,
    title: 'Order Update',
    message: `Order #${result?.orderCode} is now ${status}`,
    type: ENUM_NOTIFICATION_TYPE.ORDER_STATUS_CHANGED,
    entity: NOTIFICATION_ENTITY.ORDER,
    entityId: result?._id,
    action: isFinalStatus ? NOTIFICATION_ACTION.LIST : NOTIFICATION_ACTION.VIEW,
    meta: {
      status,
      orderCode: result?.orderCode,
    },
  }).catch((err) => {
    errorLogger.error('Order status notification failed', err);
  });

  return result;
};

const tipToBartender = async (
  profileId: string,
  orderId: string,
  amount: number,
  paymentMethodId?: string,
) => {
  const order: any = await Order.findOne({
    _id: orderId,
    customer: profileId,
  }).populate('customer', 'stripeCustomerId email name');
  if (!order) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Order not found or access denied',
    );
  }
  const amountInCents = Math.round(amount * 100);
  let stripeCustomerId = order.customer.stripeCustomerId;

  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      name: order.customer.name,
      email: order.customer.email,
    });

    stripeCustomerId = stripeCustomer.id;

    await Customer.findByIdAndUpdate(order.customer._id, { stripeCustomerId });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    customer: stripeCustomerId,

    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
    // if user selected saved card
    ...(paymentMethodId && {
      payment_method: paymentMethodId,
      confirm: true,
    }),

    // allow saving card for future
    ...(!paymentMethodId && {
      setup_future_usage: 'off_session',
    }),

    metadata: {
      orderId: order._id.toString(),
      paymentPurpose: ENUM_PAYMENT_PURPOSE.TIP,
      isSavedCardUsed: paymentMethodId ? 1 : 0,
    },
  });

  return {
    orderId: order._id,
    clientSecret: paymentIntent.client_secret,
    stripeCustomerId,
  };
};

const OrderService = {
  createOrder,
  getMyOrders,
  getSingleOrder,
  markAsUnavailableAndRefund,
  cancelOrder,
  changeOrderStatus,
  tipToBartender,
  getAllOrder,
};

export default OrderService;
