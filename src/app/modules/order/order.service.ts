/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import config from '../../config';
import AppError from '../../error/appError';
import { ENUM_PAYMENT_PURPOSE } from '../../utilities/enum';
import stripe from '../../utilities/stripe';
import Cart from '../cart/cart.model';

import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
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
import { ENUM_ORDER_STATUS } from './order.enum';
import { Order } from './order.model';
const generateOrderCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const firstChar = letters.charAt(Math.floor(Math.random() * letters.length));
  const digits = Math.floor(10 + Math.random() * 90); // ensures 2-digit number (10–99)

  return `${firstChar}${digits}`;
};
// const createOrder = async (customerId: string) => {
//   const sessionDB = await mongoose.startSession();

//   try {
//     sessionDB.startTransaction();

//     // Get Cart
//     const cart: any = await Cart.findOne({ customer: customerId })
//       .populate('items.product', 'name  isAvailable  ')
//       .populate('customer', 'name email stripeCustomerId')
//       .session(sessionDB);
//     if (!cart || cart.items.length === 0) {
//       throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
//     }

//     const currentOrder = await Order.countDocuments({
//       $or: [
//         { status: ENUM_ORDER_STATUS.QUEUED },
//         { status: ENUM_ORDER_STATUS.IN_PROGRESS },
//       ],
//     });

//     if (currentOrder >= Number(config.app.max_concurrent_orders)) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         'Too many orders in queue right now. Please try again later.',
//       );
//     }

//     console.log('cart=========>', cart);
//     cart.items.forEach((item: any) => {
//       if (!item.product.isAvailable) {
//         throw new AppError(
//           httpStatus.BAD_REQUEST,
//           `${item.product.name} is not available right now, please remove it from cart to proceed`,
//         );
//       }
//     });

//     const now = new Date();
//     console.log('venue', cart.venue);
//     // Find available bartender for the venue
//     const availableShift = await Shift.findOne({
//       venue: cart.venue,
//       status: ENUM_SHIFT_STATUS.Active,
//       startDateTime: { $lte: now },
//       endDateTime: { $gte: now },
//     }).session(sessionDB);

//     if (!availableShift) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         'No bartender is available right now. Please try again later.',
//       );
//     }
//     const orderCode = generateOrderCode();
//     // Create Order
//     const orderArr = await Order.create(
//       [
//         {
//           customer: cart.customer,
//           venue: cart.venue,
//           venueOwner: cart.venueOwner,
//           bartender: availableShift.bartender,
//           shift: availableShift._id,
//           items: cart.items,
//           totalQuantity: cart.totalQuantity,
//           subTotal: cart.subTotal,
//           deliveryFee: 0,
//           totalPrice: cart.totalPrice,
//           status: ENUM_ORDER_STATUS.PENDING,
//           orderCode,
//         },
//       ],
//       { session: sessionDB },
//     );

//     const createdOrder: any = orderArr[0];
//     const amountInCents = Math.round(createdOrder.totalPrice * 100);

//     let stripeCustomerId = cart.customer.stripeCustomerId;
//     let paymentIntent: any;
//     if (!stripeCustomerId) {
//       // Create Stripe Customer if not exists
//       const stripeCustomer = await stripe.customers.create({
//         name: cart.customer.name,
//         email: cart.customer.email,
//       });
//       stripeCustomerId = stripeCustomer.id;
//       // Stripe Checkout Session
//       paymentIntent = await stripe.paymentIntents.create({
//         amount: amountInCents,
//         currency: 'usd',
//         customer: stripeCustomerId,
//         setup_future_usage: 'off_session',
//         automatic_payment_methods: {
//           enabled: true,
//         },
//         metadata: {
//           orderId: createdOrder._id.toString(),
//           paymentPurpose: ENUM_PAYMENT_PURPOSE.ORDER,
//         },
//       });
//     } else {
//       // Stripe Checkout Session
//       paymentIntent = await stripe.paymentIntents.create({
//         amount: amountInCents,
//         currency: 'usd',
//         customer: stripeCustomerId,
//         setup_future_usage: 'off_session',
//         automatic_payment_methods: {
//           enabled: true,
//         },
//         payment_method: cart.customer.paymentMethods.length
//           ? cart.customer.paymentMethods[0]
//           : undefined,
//         metadata: {
//           orderId: createdOrder._id.toString(),
//           paymentPurpose: ENUM_PAYMENT_PURPOSE.ORDER,
//         },
//       });
//     }

//     // await Cart.deleteOne({ customer: customerId }).session(sessionDB);

//     await sessionDB.commitTransaction();
//     sessionDB.endSession();

//     return {
//       orderId: createdOrder._id,
//       clientSecret: paymentIntent.client_secret,
//       bartender: availableShift.bartender,
//     };
//   } catch (error) {
//     await sessionDB.abortTransaction();
//     sessionDB.endSession();
//     throw error;
//   }
// };

const createOrder = async (customerId: string, paymentMethodId?: string) => {
  console.log(
    'Creating order for customer:',
    customerId,
    'with payment method:',
    paymentMethodId,
  );
  const sessionDB = await mongoose.startSession();

  try {
    sessionDB.startTransaction();

    // CART
    const cart: any = await Cart.findOne({ customer: customerId })
      .populate('items.product', 'name isAvailable')
      .populate('customer', 'name email stripeCustomerId')
      .session(sessionDB);

    if (!cart || cart.items.length === 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
    }

    // validate items
    cart.items.forEach((item: any) => {
      if (!item.product.isAvailable) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `${item.product.name} product is not available right now, please remove it from cart to proceed`,
        );
      }
    });

    // ORDER LIMIT CHECK
    const currentOrder = await Order.countDocuments({
      $or: [
        { status: ENUM_ORDER_STATUS.QUEUED },
        { status: ENUM_ORDER_STATUS.IN_PROGRESS },
      ],
    });

    if (currentOrder >= Number(config.app.max_concurrent_orders)) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Too many orders right now');
    }

    // FIND SHIFT
    const now = new Date();

    const availableShift = await Shift.findOne({
      venue: cart.venue,
      status: ENUM_SHIFT_STATUS.Active,
      startDateTime: { $lte: now },
      endDateTime: { $gte: now },
    }).session(sessionDB);

    if (!availableShift) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No bartender available right now',
      );
    }

    // CREATE ORDER
    const orderArr = await Order.create(
      [
        {
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
        },
      ],
      { session: sessionDB },
    );

    const order: any = orderArr[0];
    const amountInCents = Math.round(order.totalPrice * 100);

    // STRIPE CUSTOMER
    let stripeCustomerId = cart.customer.stripeCustomerId;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        name: cart.customer.name,
        email: cart.customer.email,
      });

      stripeCustomerId = stripeCustomer.id;

      await Customer.findByIdAndUpdate(
        cart.customer._id,
        { stripeCustomerId },
        { session: sessionDB },
      );
    }

    // PAYMENT INTENT
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
        paymentPurpose: ENUM_PAYMENT_PURPOSE.ORDER,
        isSavedCardUsed: paymentMethodId ? 1 : 0,
      },
    });

    await sessionDB.commitTransaction();
    sessionDB.endSession();

    return {
      orderId: order._id,
      clientSecret: paymentIntent.client_secret,
      stripeCustomerId,
      bartender: availableShift.bartender,
      paymentIntentId: paymentIntent.id,
      paymentMethodId,
    };
  } catch (error) {
    await sessionDB.abortTransaction();
    sessionDB.endSession();
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
    // .populate({
    //   path: 'bartender',
    //   select: 'name profile_image',
    // })
    // .populate({
    //   path: 'venue',
    //   select: 'name location',
    // })
    // .populate({
    //   path: 'venueOwner',
    //   select: 'name',
    // }),
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
    // .populate({
    //   path: 'bartender',
    //   select: 'name profile_image',
    // })
    .populate({
      path: 'venue',
      select: 'name location address logo',
    });
  // .populate({
  //   path: 'venueOwner',
  //   select: 'name',
  // });

  if (!order) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Order not found or access denied',
    );
  }

  return order;
};

const markAsUnavailableAndRefund = async (orderId: string) => {
  const sessionDB = await mongoose.startSession();

  try {
    sessionDB.startTransaction();

    const order = await Order.findById(orderId).session(sessionDB);
    if (!order) {
      throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
    }

    if (order.status === ENUM_ORDER_STATUS.CANCELLED) {
      await sessionDB.abortTransaction();
      sessionDB.endSession();
      return;
    }

    order.status = ENUM_ORDER_STATUS.CANCELLED;
    await order.save({ session: sessionDB });

    await sessionDB.commitTransaction();
    sessionDB.endSession();

    try {
      await stripe.refunds.create({
        payment_intent: order.paymentIntentId,
      });
    } catch (error: any) {
      if (error.code === 'charge_already_refunded') {
        console.log('Already refunded, ignoring...');
        errorLogger.warn(`Charge already refunded for order ID: ${orderId}`);
      } else {
        throw error;
      }
    }

    NotificationService.sendNotification({
      receiver: order.customer,
      title: 'Order Cancelled & Refunded',
      message: `Your order #${order.orderCode} has been cancelled.`,
      type: ENUM_NOTIFICATION_TYPE.ORDER_STATUS_CHANGED,
      entity: NOTIFICATION_ENTITY.ORDER,
      entityId: order._id,
      action: NOTIFICATION_ACTION.LIST,
      meta: {
        status: ENUM_ORDER_STATUS.CANCELLED,
        orderCode: order.orderCode,
      },
    }).catch((err) => {
      errorLogger.error('Notification failed', err);
    });
  } catch (error: any) {
    await sessionDB.abortTransaction().catch(() => {});
    sessionDB.endSession();

    console.error('Refund Transaction Error:', error);

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Transaction failed',
    );
  }
};

const changeOrderStatus = async (
  userData: JwtPayload,
  orderId: string,
  status: string,
) => {
  if (
    userData.role == USER_ROLE.customer &&
    status != ENUM_ORDER_STATUS.PICKED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Customer can only mark order as picked',
    );
  }
  const order = await Order.findOne({
    _id: orderId,
    $or: [{ customer: userData.profileId }, { bartender: userData.profileId }],
  });

  if (!order) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Order not found or access denied',
    );
  }

  const result = await Order.findByIdAndUpdate(
    orderId,
    { status },
    { new: true, runValidators: true },
  );

  // 🔔 NOTIFICATION LOGIC
  // =====================================================

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
  orderId: string,
  amount: number,
  paymentMethodId?: string,
) => {
  const order: any = await Order.findById(orderId).populate(
    'customer',
    'stripeCustomerId email name',
  );
  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }
  const amountInCents = Math.round(amount * 100);
  // 5. STRIPE CUSTOMER
  // =========================
  let stripeCustomerId = order.customer.stripeCustomerId;

  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      name: order.customer.name,
      email: order.customer.email,
    });

    stripeCustomerId = stripeCustomer.id;

    await Customer.findByIdAndUpdate(order.customer._id, { stripeCustomerId });
  }

  // =========================
  // 6. PAYMENT INTENT
  // =========================
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
  changeOrderStatus,
  tipToBartender,
  getAllOrder,
};

export default OrderService;
