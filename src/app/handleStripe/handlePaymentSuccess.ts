/* eslint-disable @typescript-eslint/no-explicit-any */
import { appEventEmitter } from '../events/eventEmitter';
import Cart from '../modules/cart/cart.model';
import { ENUM_ORDER_STATUS } from '../modules/order/order.enum';
import { Order } from '../modules/order/order.model';
import {
  ENUM_TRANSACTION_REASON,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '../modules/transaction/transaction.enum';
import Transaction from '../modules/transaction/transaction.model';
import { errorLogger } from '../shared/logger';
import { ENUM_PAYMENT_PURPOSE } from '../utilities/enum';

export const handlePaymentSuccess = async (
  metaData: any,
  transactionId: string,
  amount: number,
) => {
  try {
    if (!metaData?.paymentPurpose) {
      errorLogger.error('Invalid metadata: missing paymentPurpose');
      return;
    }

    if (metaData.paymentPurpose === ENUM_PAYMENT_PURPOSE.ORDER) {
      const existingPayment = await Transaction.findOne({
        stripePaymentIntentId: transactionId,
      });
      if (existingPayment) return;

      const order: any = await Order.findById(metaData.orderId);
      if (!order) return;
      const ORDER_COLORS = [
        '#22C55E', // green
        '#16A34A', // dark green
        '#84CC16', // lime
        '#06B6D4', // cyan
        '#0891B2', // dark cyan
        '#3B82F6', // blue
        '#2563EB', // dark blue
        '#6366F1', // indigo
        '#8B5CF6', // violet
        '#A855F7', // purple
        '#D946EF', // fuchsia
        '#EC4899', // pink
        '#F43F5E', // rose
        '#EF4444', // red
        '#F97316', // orange
        '#FB923C', // light orange
        '#F59E0B', // amber
        '#EAB308', // yellow
        '#14B8A6', // teal
        '#10B981', // emerald
      ];

      const randomColor =
        ORDER_COLORS[Math.floor(Math.random() * ORDER_COLORS.length)];
      const updatedOrder = await Order.findByIdAndUpdate(
        metaData.orderId,
        {
          status: ENUM_ORDER_STATUS.QUEUED,
          paymentIntentId: transactionId,
          colorCode: randomColor,
        },
        { new: true, runValidators: true },
      );

      await Cart.deleteOne({ customer: order.customer });

      await Transaction.create({
        customer: updatedOrder?.customer,
        type: TRANSACTION_TYPE.PAYMENT,
        status: TRANSACTION_STATUS.COMPLETED,
        amount,
        stripePaymentIntentId: transactionId,
        description: 'Payment for order',
        order: updatedOrder?._id,
        metadata: { reason: ENUM_TRANSACTION_REASON.ORDER },
      });

      // ✅ EMIT EVENT
      appEventEmitter.emit('order.created', {
        orderId: updatedOrder?._id,
        bartender: updatedOrder?.bartender,
        customer: updatedOrder?.customer,
        orderCode: updatedOrder?.orderCode,
      });
    } else if (metaData.paymentPurpose === ENUM_PAYMENT_PURPOSE.TIP) {
      const order = await Order.findById(metaData.orderId);
      if (!order) return;

      const existingTip = await Transaction.findOne({
        stripePaymentIntentId: transactionId,
      });
      if (existingTip) return;

      await Transaction.create({
        customer: order.customer,
        type: TRANSACTION_TYPE.PAYMENT,
        status: TRANSACTION_STATUS.COMPLETED,
        amount,
        stripePaymentIntentId: transactionId,
        description: 'Tip payment',
        order: metaData.orderId,
        metadata: { reason: ENUM_TRANSACTION_REASON.TIP },
      });

      await Order.findByIdAndUpdate(metaData.orderId, {
        tipAmount: amount,
      });

      // ✅ EMIT EVENT
      appEventEmitter.emit('order.tip.received', {
        orderId: order?._id,
        bartender: order?.bartender,
        amount,
      });
    }
  } catch (error) {
    errorLogger.error('handlePaymentSuccess error', error);
  }
};
