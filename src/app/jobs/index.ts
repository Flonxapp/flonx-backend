import cron from 'node-cron';
import config from '../config';
import { handlePaymentSuccess } from '../handleStripe/handlePaymentSuccess';
import { Device } from '../modules/device/device.model';
import {
  ENUM_ORDER_STATUS,
  ENUM_REFUND_STATUS,
  MAX_REFUND_ATTEMPTS,
} from '../modules/order/order.enum';
import { Order } from '../modules/order/order.model';
import OrderRefundService from '../modules/order/order.refund.service';
import { ENUM_SHIFT_STATUS } from '../modules/shift/shift.enum';
import { Shift } from '../modules/shift/shift.model';
import { errorLogger, logger } from '../shared/logger';
import { runExclusive } from '../utilities/cronLock';
import stripe from '../utilities/stripe';

const MINUTE = 60 * 1000;

// Upcoming -> Active -> Completed based on shift times
const updateShiftStatuses = async () => {
  const now = new Date();
  const activated = await Shift.updateMany(
    { status: ENUM_SHIFT_STATUS.Upcoming, startDateTime: { $lte: now } },
    { $set: { status: ENUM_SHIFT_STATUS.Active } },
  );
  const completed = await Shift.updateMany(
    { status: ENUM_SHIFT_STATUS.Active, endDateTime: { $lte: now } },
    { $set: { status: ENUM_SHIFT_STATUS.Completed } },
  );
  if (activated.modifiedCount || completed.modifiedCount) {
    logger.info('Shift statuses updated', {
      active: activated.modifiedCount,
      completed: completed.modifiedCount,
    });
  }
};

// retry refunds that failed or never started
const retryRefunds = async () => {
  const stuckBefore = new Date(Date.now() - 5 * MINUTE);
  const orders = await Order.find({
    status: ENUM_ORDER_STATUS.CANCELLED,
    paymentIntentId: { $nin: [null, ''] },
    refundAttempts: { $lt: MAX_REFUND_ATTEMPTS },
    $or: [
      { refundStatus: ENUM_REFUND_STATUS.FAILED },
      {
        refundStatus: ENUM_REFUND_STATUS.PENDING,
        stripeRefundId: { $exists: false },
        updatedAt: { $lte: stuckBefore },
      },
    ],
  })
    .select('_id')
    .limit(50);

  for (const order of orders) {
    await OrderRefundService.issueRefund(String(order._id));
  }
  if (orders.length) logger.info(`Refund retry processed ${orders.length}`);
};

// Unpaid orders past their TTL. If Stripe says the payment actually went
// through (webhook missed), process it; otherwise cancel the payment.
const cleanUpPendingOrders = async () => {
  const cutoff = new Date(
    Date.now() - config.app.pending_order_ttl_minutes * MINUTE,
  );
  const orders = await Order.find({
    status: ENUM_ORDER_STATUS.PENDING,
    createdAt: { $lte: cutoff },
  })
    .select('_id paymentIntentId')
    .limit(100);

  for (const order of orders) {
    try {
      if (order.paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(order.paymentIntentId);
        if (pi.status === 'succeeded') {
          await handlePaymentSuccess(pi.metadata, pi.id, pi.amount / 100);
          continue;
        }
        if (pi.status === 'processing') continue;
        if (pi.status !== 'canceled') {
          await stripe.paymentIntents.cancel(pi.id);
        }
      }
      await Order.updateOne(
        { _id: order._id, status: ENUM_ORDER_STATUS.PENDING },
        {
          status: ENUM_ORDER_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: 'Payment not completed',
        },
      );
    } catch (error) {
      errorLogger.error('Pending order cleanup failed', {
        orderId: order._id,
        error,
      });
    }
  }
  if (orders.length) logger.info(`Pending order cleanup: ${orders.length}`);
};

const removeOldDevices = async () => {
  const result = await Device.deleteMany({
    isActive: false,
    lastActiveAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * MINUTE) },
  });
  logger.info(`Device cleanup deleted ${result.deletedCount}`);
};

let started = false;

// Call once after the DB is connected. Each job runs on one server at a time.
export const startJobs = () => {
  if (started) return;
  started = true;

  cron.schedule('* * * * *', () =>
    runExclusive('shift-status', 50 * 1000, updateShiftStatuses),
  );
  cron.schedule('*/5 * * * *', () =>
    runExclusive('pending-orders', 4 * MINUTE, cleanUpPendingOrders),
  );
  cron.schedule('*/10 * * * *', () =>
    runExclusive('refund-retry', 9 * MINUTE, retryRefunds),
  );
  cron.schedule('0 2 * * 0', () =>
    runExclusive('device-cleanup', 30 * MINUTE, removeOldDevices),
  );
  logger.info('Background jobs started');
};
