import { ClientSession, Types } from 'mongoose';
import config from '../../config';
import {
  ENUM_TRANSACTION_REASON,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '../transaction/transaction.enum';
import Transaction from '../transaction/transaction.model';
import { VenueOwner } from '../venue_owner/venue_owner.model';

// amounts are USD, rounded to cents
export const toMoney = (value: number) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const toCents = (value: number) => Math.round(Number(value) * 100);

type TEarningReason = 'ORDER' | 'TIP';

const feePercentageFor = (reason: TEarningReason) =>
  reason === 'TIP'
    ? config.wallet.tip_platform_fee_percentage
    : config.wallet.platform_fee_percentage;

export const splitAmount = (
  grossAmount: number,
  reason: TEarningReason = 'ORDER',
) => {
  const gross = toMoney(grossAmount);
  const feePercentage = feePercentageFor(reason);
  const platformFee = toMoney((gross * feePercentage) / 100);
  const venueEarning = toMoney(gross - platformFee);
  return { gross, platformFee, venueEarning, feePercentage };
};

export const splitOrderAmount = (grossAmount: number) =>
  splitAmount(grossAmount, 'ORDER');

// Add an order or tip payment to the venue owner's wallet.
// Call it inside the same DB transaction that marks the payment as processed.
const creditEarning = async (
  params: {
    reason: TEarningReason;
    orderId: Types.ObjectId | string;
    venueOwnerId: Types.ObjectId | string;
    grossAmount: number;
    paymentIntentId: string;
  },
  session: ClientSession,
) => {
  const { gross, platformFee, venueEarning, feePercentage } = splitAmount(
    params.grossAmount,
    params.reason,
  );
  const label = params.reason === 'TIP' ? 'Tip' : 'Order';

  const records: Record<string, unknown>[] = [
    {
      venueOwner: params.venueOwnerId,
      order: params.orderId,
      type: TRANSACTION_TYPE.EARNING,
      status: TRANSACTION_STATUS.COMPLETED,
      amount: venueEarning,
      stripePaymentIntentId: params.paymentIntentId,
      description: `${label} earning credited to wallet`,
      metadata: {
        reason: params.reason,
        grossAmount: gross,
        platformFee,
        feePercentage,
      },
    },
  ];
  if (platformFee > 0) {
    records.push({
      order: params.orderId,
      type: TRANSACTION_TYPE.PLATFORM_FEE,
      status: TRANSACTION_STATUS.COMPLETED,
      amount: platformFee,
      stripePaymentIntentId: params.paymentIntentId,
      description: `Platform fee for ${label.toLowerCase()}`,
      metadata: {
        reason: params.reason,
        grossAmount: gross,
        feePercentage,
        venueOwner: params.venueOwnerId,
      },
    });
  }
  await Transaction.create(records, { session, ordered: true });

  await VenueOwner.updateOne(
    { _id: params.venueOwnerId },
    { $inc: { currentBalance: venueEarning, totalEarning: venueEarning } },
    { session },
  );

  return { gross, platformFee, venueEarning };
};

const creditOrderEarning = (
  params: {
    orderId: Types.ObjectId | string;
    venueOwnerId: Types.ObjectId | string;
    grossAmount: number;
    paymentIntentId: string;
  },
  session: ClientSession,
) => creditEarning({ ...params, reason: 'ORDER' }, session);

// Take the order earning back when the order is refunded. Safe to call twice.
const reverseOrderEarning = async (
  orderId: Types.ObjectId | string,
  session: ClientSession,
) => {
  // tips are not refunded, so only the order earning is reversed
  const earning = await Transaction.findOne({
    order: orderId,
    type: TRANSACTION_TYPE.EARNING,
    'metadata.reason': ENUM_TRANSACTION_REASON.ORDER,
  }).session(session);
  if (!earning || !earning.venueOwner) return null;

  const alreadyReversed = await Transaction.exists({
    order: orderId,
    type: TRANSACTION_TYPE.REFUND,
    'metadata.reason': ENUM_TRANSACTION_REASON.ORDER_REFUND_REVERSAL,
  }).session(session);
  if (alreadyReversed) return null;

  await Transaction.create(
    [
      {
        venueOwner: earning.venueOwner,
        order: orderId,
        type: TRANSACTION_TYPE.REFUND,
        status: TRANSACTION_STATUS.COMPLETED,
        amount: earning.amount,
        stripePaymentIntentId: earning.stripePaymentIntentId,
        description: 'Order refunded - earning removed from wallet',
        metadata: { reason: ENUM_TRANSACTION_REASON.ORDER_REFUND_REVERSAL },
      },
    ],
    { session },
  );

  await VenueOwner.updateOne(
    { _id: earning.venueOwner },
    {
      $inc: {
        currentBalance: -earning.amount,
        totalEarning: -earning.amount,
      },
    },
    { session },
  );

  return earning.amount;
};

const WalletService = {
  creditEarning,
  creditOrderEarning,
  reverseOrderEarning,
};

export default WalletService;
