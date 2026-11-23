/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Credit venue owners for orders and tips paid before the wallet existed.
// Run: node dist/scripts/backfillVenueEarnings.js [--apply]
import mongoose from 'mongoose';
import config from '../app/config';
import { ENUM_ORDER_STATUS } from '../app/modules/order/order.enum';
import { Order } from '../app/modules/order/order.model';
import {
  ENUM_TRANSACTION_REASON,
  TRANSACTION_TYPE,
} from '../app/modules/transaction/transaction.enum';
import Transaction from '../app/modules/transaction/transaction.model';
import WalletService, {
  splitAmount,
} from '../app/modules/wallet/wallet.service';

const PAID_STATUSES = [
  ENUM_ORDER_STATUS.QUEUED,
  ENUM_ORDER_STATUS.IN_PROGRESS,
  ENUM_ORDER_STATUS.READY_FOR_PIC,
  ENUM_ORDER_STATUS.PICKED,
];

type TItem = {
  reason: 'ORDER' | 'TIP';
  order: any;
  gross: number;
  paymentIntentId: string;
};

const earningFilter = (item: TItem) =>
  item.reason === 'ORDER'
    ? {
        order: item.order._id,
        type: TRANSACTION_TYPE.EARNING,
        'metadata.reason': ENUM_TRANSACTION_REASON.ORDER,
      }
    : {
        stripePaymentIntentId: item.paymentIntentId,
        type: TRANSACTION_TYPE.EARNING,
        'metadata.reason': ENUM_TRANSACTION_REASON.TIP,
      };

const collectItems = async (): Promise<TItem[]> => {
  const items: TItem[] = [];

  const orders = await Order.find({
    status: { $in: PAID_STATUSES },
    paymentIntentId: { $exists: true, $nin: [null, ''] },
  })
    .select('_id venueOwner totalPrice paymentIntentId orderCode')
    .lean();
  for (const order of orders as any[]) {
    const payment: any = await Transaction.findOne({
      order: order._id,
      type: TRANSACTION_TYPE.PAYMENT,
      'metadata.reason': ENUM_TRANSACTION_REASON.ORDER,
    }).lean();
    items.push({
      reason: 'ORDER',
      order,
      gross: payment?.amount ?? order.totalPrice,
      paymentIntentId: order.paymentIntentId,
    });
  }

  // tips count even on cancelled orders
  const tips: any[] = await Transaction.find({
    type: TRANSACTION_TYPE.PAYMENT,
    'metadata.reason': ENUM_TRANSACTION_REASON.TIP,
  }).lean();
  for (const tip of tips) {
    const order: any = await Order.findById(tip.order)
      .select('_id venueOwner orderCode')
      .lean();
    if (!order) continue;
    items.push({
      reason: 'TIP',
      order,
      gross: tip.amount,
      paymentIntentId: tip.stripePaymentIntentId,
    });
  }
  return items;
};

const run = async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(config.database_url as string);

  const items = await collectItems();
  const totals = { count: 0, venue: 0, fee: 0 };

  for (const item of items) {
    if (await Transaction.exists(earningFilter(item))) continue;

    const split = splitAmount(item.gross, item.reason);
    console.log(
      `${apply ? 'CREDIT' : 'WOULD CREDIT'} ${item.reason} order #${item.order.orderCode} venueOwner=${item.order.venueOwner} gross=$${split.gross} venue=$${split.venueEarning} fee=$${split.platformFee}`,
    );

    if (apply) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const exists = await Transaction.exists(earningFilter(item)).session(
            session,
          );
          if (exists) return;
          await WalletService.creditEarning(
            {
              reason: item.reason,
              orderId: item.order._id,
              venueOwnerId: item.order.venueOwner,
              grossAmount: item.gross,
              paymentIntentId: item.paymentIntentId,
            },
            session,
          );
          if (item.reason === 'TIP') {
            await Order.updateOne(
              { _id: item.order._id },
              { $addToSet: { tipPaymentIntentIds: item.paymentIntentId } },
              { session },
            );
          }
        });
      } finally {
        await session.endSession();
      }
    }

    totals.count += 1;
    totals.venue += split.venueEarning;
    totals.fee += split.platformFee;
  }

  console.log(
    `\n${apply ? 'Credited' : 'Would credit'} ${totals.count} payment(s): venue owners $${totals.venue.toFixed(2)}, platform fee $${totals.fee.toFixed(2)}`,
  );
  if (!apply) console.log('Dry run only. Re-run with --apply to write.');

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
