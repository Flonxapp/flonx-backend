/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import { appEventEmitter } from '../events/eventEmitter';
import WalletService from '../modules/wallet/wallet.service';
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
      const ORDER_COLORS = [
        '#22C55E',
        '#16A34A',
        '#84CC16',
        '#06B6D4',
        '#0891B2',
        '#3B82F6',
        '#2563EB',
        '#6366F1',
        '#8B5CF6',
        '#A855F7',
        '#D946EF',
        '#EC4899',
        '#F43F5E',
        '#EF4444',
        '#F97316',
        '#FB923C',
        '#F59E0B',
        '#EAB308',
        '#14B8A6',
        '#10B981',
      ];

      const randomColor =
        ORDER_COLORS[Math.floor(Math.random() * ORDER_COLORS.length)];

      // One DB transaction. Only a PENDING order is updated, so a repeated
      // webhook does nothing.
      let updatedOrder: any = null;
      const sessionDB = await mongoose.startSession();
      try {
        await sessionDB.withTransaction(async () => {
          updatedOrder = await Order.findOneAndUpdate(
            { _id: metaData.orderId, status: ENUM_ORDER_STATUS.PENDING },
            {
              status: ENUM_ORDER_STATUS.QUEUED,
              paymentIntentId: transactionId,
              colorCode: randomColor,
            },
            { new: true, runValidators: true, session: sessionDB },
          );
          if (!updatedOrder) return;

          await Cart.deleteOne({ customer: updatedOrder.customer }).session(
            sessionDB,
          );

          await Transaction.create(
            [
              {
                customer: updatedOrder.customer,
                type: TRANSACTION_TYPE.PAYMENT,
                status: TRANSACTION_STATUS.COMPLETED,
                amount,
                stripePaymentIntentId: transactionId,
                description: 'Payment for order',
                order: updatedOrder._id,
                metadata: { reason: ENUM_TRANSACTION_REASON.ORDER },
              },
            ],
            { session: sessionDB },
          );

          await WalletService.creditOrderEarning(
            {
              orderId: updatedOrder._id,
              venueOwnerId: updatedOrder.venueOwner,
              grossAmount: amount,
              paymentIntentId: transactionId,
            },
            sessionDB,
          );
        });
      } finally {
        await sessionDB.endSession();
      }

      if (!updatedOrder) return; // already processed

      appEventEmitter.emit('order.created', {
        orderId: updatedOrder?._id,
        bartender: updatedOrder?.bartender,
        customer: updatedOrder?.customer,
        orderCode: updatedOrder?.orderCode,
      });
    } else if (metaData.paymentPurpose === ENUM_PAYMENT_PURPOSE.TIP) {
      // One DB transaction. The tipPaymentIntentIds check skips a repeated
      // webhook; several tips per order add up.
      let order: any = null;
      const sessionDB = await mongoose.startSession();
      try {
        await sessionDB.withTransaction(async () => {
          order = await Order.findOneAndUpdate(
            {
              _id: metaData.orderId,
              tipPaymentIntentIds: { $ne: transactionId },
            },
            [
              {
                $set: {
                  tipAmount: {
                    $round: [
                      { $add: [{ $ifNull: ['$tipAmount', 0] }, amount] },
                      2,
                    ],
                  },
                  tipPaymentIntentIds: {
                    $concatArrays: [
                      { $ifNull: ['$tipPaymentIntentIds', []] },
                      [transactionId],
                    ],
                  },
                },
              },
            ],
            { new: true, session: sessionDB },
          );
          if (!order) return;

          await Transaction.create(
            [
              {
                customer: order.customer,
                type: TRANSACTION_TYPE.PAYMENT,
                status: TRANSACTION_STATUS.COMPLETED,
                amount,
                stripePaymentIntentId: transactionId,
                description: 'Tip payment',
                order: order._id,
                metadata: { reason: ENUM_TRANSACTION_REASON.TIP },
              },
            ],
            { session: sessionDB },
          );

          // venue owner passes the tip on to the bartender
          await WalletService.creditEarning(
            {
              reason: 'TIP',
              orderId: order._id,
              venueOwnerId: order.venueOwner,
              grossAmount: amount,
              paymentIntentId: transactionId,
            },
            sessionDB,
          );
        });
      } finally {
        await sessionDB.endSession();
      }

      if (!order) return; // already processed

      appEventEmitter.emit('order.tip.received', {
        orderId: order?._id,
        bartender: order?.bartender,
        amount,
      });
    }
  } catch (error) {
    errorLogger.error('handlePaymentSuccess error', error);
    // rethrow so Stripe retries the event
    throw error;
  }
};
