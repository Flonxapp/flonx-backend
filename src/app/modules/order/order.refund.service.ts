/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import Stripe from 'stripe';
import AppError from '../../error/appError';
import { errorLogger, logger } from '../../shared/logger';
import stripe from '../../utilities/stripe';
import {
  ENUM_NOTIFICATION_TYPE,
  NOTIFICATION_ACTION,
  NOTIFICATION_ENTITY,
} from '../notification/notification.enum';
import NotificationService from '../notification/notification.services';
import {
  ENUM_TRANSACTION_REASON,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '../transaction/transaction.enum';
import Transaction from '../transaction/transaction.model';
import { USER_ROLE } from '../user/user.constant';
import WalletService from '../wallet/wallet.service';
import {
  BARTENDER_CANCELLABLE_STATUSES,
  CUSTOMER_CANCELLABLE_STATUSES,
  ENUM_ORDER_CANCELLED_BY,
  ENUM_ORDER_STATUS,
  ENUM_REFUND_STATUS,
  MAX_REFUND_ATTEMPTS,
} from './order.enum';
import { Order } from './order.model';

const notify = (payload: Record<string, any>) =>
  NotificationService.sendNotification({
    type: ENUM_NOTIFICATION_TYPE.ORDER_STATUS_CHANGED,
    entity: NOTIFICATION_ENTITY.ORDER,
    action: NOTIFICATION_ACTION.VIEW,
    ...payload,
  }).catch((err: any) =>
    errorLogger.error('Order cancel notification failed', err),
  );

const mapStripeRefundStatus = (status?: string | null) => {
  if (status === 'succeeded') return ENUM_REFUND_STATUS.SUCCEEDED;
  if (status === 'failed' || status === 'canceled')
    return ENUM_REFUND_STATUS.FAILED;
  return ENUM_REFUND_STATUS.PENDING;
};

const recordCustomerRefund = async (order: any, refund: Stripe.Refund) => {
  const exists = await Transaction.exists({ stripeRefundId: refund.id });
  if (exists) return;
  await Transaction.create({
    customer: order.customer,
    order: order._id,
    type: TRANSACTION_TYPE.REFUND,
    status:
      refund.status === 'succeeded'
        ? TRANSACTION_STATUS.COMPLETED
        : TRANSACTION_STATUS.PENDING,
    amount: refund.amount / 100,
    stripePaymentIntentId: order.paymentIntentId,
    stripeRefundId: refund.id,
    description: 'Order cancelled - refunded to customer',
    metadata: { reason: ENUM_TRANSACTION_REASON.ORDER_REFUND },
  });
};

// Refund a cancelled order. Safe to call again; does nothing once refunded.
// refundAttempts is part of the idempotency key, so a network error retries
// with the same key and a real Stripe failure retries with a new one.
const issueRefund = async (orderId: string) => {
  const order: any = await Order.findById(orderId);
  if (!order || order.status !== ENUM_ORDER_STATUS.CANCELLED) return order;
  if (!order.paymentIntentId) return order;
  if (order.refundStatus === ENUM_REFUND_STATUS.SUCCEEDED) return order;
  if (order.refundStatus === ENUM_REFUND_STATUS.PENDING && order.stripeRefundId)
    return order; // webhook will update it

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: order.paymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          orderId: order._id.toString(),
          orderCode: order.orderCode,
          cancelledBy: order.cancelledBy || '',
        },
      },
      {
        idempotencyKey: `order-refund-${order._id.toString()}-${order.refundAttempts || 0}`,
      },
    );

    const updated = await Order.findByIdAndUpdate(
      order._id,
      {
        $set: {
          refundStatus: mapStripeRefundStatus(refund.status),
          stripeRefundId: refund.id,
          refundedAmount: refund.amount / 100,
        },
        $unset: { refundError: 1 },
      },
      { new: true },
    );
    await recordCustomerRefund(order, refund);
    logger.info('Order refund created', {
      orderId,
      refundId: refund.id,
      status: refund.status,
    });
    return updated;
  } catch (error: any) {
    if (error?.code === 'charge_already_refunded') {
      return Order.findByIdAndUpdate(
        order._id,
        {
          $set: { refundStatus: ENUM_REFUND_STATUS.SUCCEEDED },
          $unset: { refundError: 1 },
        },
        { new: true },
      );
    }

    const definite = !!error?.statusCode && error.statusCode < 500;
    const message = error?.raw?.message || error?.message || 'Refund failed';
    errorLogger.error('Order refund failed', {
      orderId,
      error: message,
      willRetry: (order.refundAttempts || 0) + 1 < MAX_REFUND_ATTEMPTS,
    });
    return Order.findByIdAndUpdate(
      order._id,
      {
        $set: { refundStatus: ENUM_REFUND_STATUS.FAILED, refundError: message },
        $inc: { refundAttempts: definite ? 1 : 0 },
      },
      { new: true },
    );
  }
};

// The only way an order gets cancelled: cancel it, take the earning back
// from the venue owner, then refund the customer.
const cancelOrderAndRefund = async (
  user: JwtPayload,
  orderId: string,
  reason?: string,
) => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid order id');
  }

  const isCustomer = user.role === USER_ROLE.customer;
  const isBartender = user.role === USER_ROLE.bartender;
  if (!isCustomer && !isBartender) {
    throw new AppError(httpStatus.FORBIDDEN, 'You cannot cancel this order');
  }

  const ownerFilter = isCustomer
    ? { customer: user.profileId }
    : { bartender: user.profileId };
  const order: any = await Order.findOne({ _id: orderId, ...ownerFilter });
  if (!order) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Order not found or access denied',
    );
  }

  // already cancelled, just make sure the refund went through
  if (order.status === ENUM_ORDER_STATUS.CANCELLED) {
    return issueRefund(orderId);
  }

  const allowed = isCustomer
    ? CUSTOMER_CANCELLABLE_STATUSES
    : BARTENDER_CANCELLABLE_STATUSES;
  if (!allowed.includes(order.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      isCustomer && order.status !== ENUM_ORDER_STATUS.PICKED
        ? 'Your order is already being prepared and can no longer be cancelled. Please talk to the bartender.'
        : `An order that is ${order.status.toLowerCase().replace(/_/g, ' ')} cannot be cancelled`,
    );
  }

  const session = await mongoose.startSession();
  let cancelled: any = null;
  try {
    await session.withTransaction(async () => {
      // only if the status hasn't changed meanwhile
      cancelled = await Order.findOneAndUpdate(
        { _id: orderId, ...ownerFilter, status: { $in: allowed } },
        {
          $set: {
            status: ENUM_ORDER_STATUS.CANCELLED,
            cancelledBy: isCustomer
              ? ENUM_ORDER_CANCELLED_BY.CUSTOMER
              : ENUM_ORDER_CANCELLED_BY.BARTENDER,
            cancelledAt: new Date(),
            ...(reason ? { cancelReason: reason } : {}),
            refundStatus: ENUM_REFUND_STATUS.PENDING,
          },
        },
        { new: true, session },
      );
      if (!cancelled) return;
      await WalletService.reverseOrderEarning(String(cancelled._id), session);
    });
  } finally {
    await session.endSession();
  }

  if (!cancelled) {
    throw new AppError(
      httpStatus.CONFLICT,
      'The order status just changed. Please refresh and try again.',
    );
  }

  const result: any = await issueRefund(orderId);

  const refundText =
    result?.refundStatus === ENUM_REFUND_STATUS.FAILED
      ? 'Your refund is being processed.'
      : `$${Number(cancelled.totalPrice).toFixed(2)} has been refunded to your card. It may take 5-10 business days to appear.`;

  notify({
    receiver: cancelled.customer,
    title: 'Order Cancelled & Refunded',
    message: isCustomer
      ? `You cancelled order #${cancelled.orderCode}. ${refundText}`
      : `Your order #${cancelled.orderCode} was cancelled by the bartender. ${refundText}`,
    meta: {
      status: ENUM_ORDER_STATUS.CANCELLED,
      orderCode: cancelled.orderCode,
    },
  });
  if (isCustomer) {
    notify({
      receiver: cancelled.bartender,
      title: 'Order Cancelled',
      message: `Order #${cancelled.orderCode} was cancelled by the customer.`,
      action: NOTIFICATION_ACTION.LIST,
      meta: {
        status: ENUM_ORDER_STATUS.CANCELLED,
        orderCode: cancelled.orderCode,
      },
    });
  }

  return result;
};

const handleRefundUpdated = async (refund: Stripe.Refund) => {
  const order: any = await Order.findOne({ stripeRefundId: refund.id });
  if (!order) return;

  const status = mapStripeRefundStatus(refund.status);
  if (status === ENUM_REFUND_STATUS.FAILED) {
    // refund failed in Stripe, let the retry job try again
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          refundStatus: ENUM_REFUND_STATUS.FAILED,
          refundError: `Refund ${refund.status}: ${refund.failure_reason || 'unknown reason'}`,
        },
        $unset: { stripeRefundId: 1 },
        $inc: { refundAttempts: 1 },
      },
    );
    await Transaction.updateOne(
      { stripeRefundId: refund.id },
      { status: TRANSACTION_STATUS.FAILED },
    );
    errorLogger.error('Order refund failed asynchronously', {
      orderId: order._id,
      refundId: refund.id,
      reason: refund.failure_reason,
    });
    return;
  }

  await Order.updateOne({ _id: order._id }, { refundStatus: status });
  if (status === ENUM_REFUND_STATUS.SUCCEEDED) {
    await Transaction.updateOne(
      { stripeRefundId: refund.id },
      { status: TRANSACTION_STATUS.COMPLETED },
    );
  }
};

const OrderRefundService = {
  cancelOrderAndRefund,
  issueRefund,
  handleRefundUpdated,
};

export default OrderRefundService;
