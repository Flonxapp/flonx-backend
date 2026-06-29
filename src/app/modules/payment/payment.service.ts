/* eslint-disable @typescript-eslint/no-explicit-any */
// payment.service.ts
import mongoose from 'mongoose';
import Stripe from 'stripe';
import config from '../../config';
import AppError from '../../error/appError';
import { ENUM_PAYMENT_STATUS } from '../../utilities/enum';
import { ENUM_ORDER_STATUS } from '../order/order.enum';
import { Order } from '../order/order.model';
import Transaction from '../transaction/transaction.model';
import { VenueOwner } from '../venue_owner/venue_owner.model';

const stripe = new Stripe(config.stripe.stripe_secret_key as string);

export const getVenueOwnerWallet = async (venueOwnerId: string) => {
  const venueOwner = await VenueOwner.findById(venueOwnerId).select(
    'stripeConnectedAccountId isStripeAccountConnected',
  );
  if (!venueOwner) throw new AppError(404, 'Venue owner not found');

  const venueOwnerObjectId = new mongoose.Types.ObjectId(venueOwnerId);

  // 1) Total earnings (lifetime) — sum of order totals for completed & paid orders
  const totalEarningsResult = await Order.aggregate([
    {
      $match: {
        venueOwner: venueOwnerObjectId,
        status: ENUM_ORDER_STATUS.PICKED,
        paymentStatus: ENUM_PAYMENT_STATUS.SUCCESS,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalPrice' },
      },
    },
  ]);

  const totalEarnings = totalEarningsResult[0]?.total ?? 0;

  // 2) Pending balance — paid but not yet transferred
  const pendingResult = await Order.aggregate([
    {
      $match: {
        venueOwner: venueOwnerObjectId,
        paymentStatus: ENUM_PAYMENT_STATUS.SUCCESS,
        status: {
          $in: [ENUM_ORDER_STATUS.IN_PROGRESS, ENUM_ORDER_STATUS.PICKED],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalPrice' },
      },
    },
  ]);

  const pendingBalance = pendingResult[0]?.total ?? 0;

  // 3) Available balance in Stripe (cleared funds on connected account)
  let availableBalance = 0;
  if (
    venueOwner.isStripeAccountConnected &&
    venueOwner.stripeConnectedAccountId
  ) {
    try {
      const stripeBalance = await stripe.balance.retrieve(
        {},
        { stripeAccount: venueOwner.stripeConnectedAccountId },
      );
      availableBalance =
        stripeBalance.available.reduce(
          (sum: number, b: any) => sum + b.amount,
          0,
        ) / 100;
    } catch (err: any) {
      console.error('Failed to fetch Stripe balance:', err);
    }
  }

  // Recent transactions
  const recentTransactions = await Transaction.find({
    venueOwner: venueOwnerObjectId,
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return {
    totalEarnings,
    pendingBalance,
    availableBalance,
    recentTransactions,
  };
};

export const withdrawFromVenueOwner = async (
  venueOwnerId: string,
  amount: number,
  currency = 'usd',
) => {
  const venueOwner = await VenueOwner.findById(venueOwnerId).select(
    'stripeConnectedAccountId isStripeAccountConnected',
  );
  if (!venueOwner) throw new AppError(404, 'Venue owner not found');

  if (
    !venueOwner.isStripeAccountConnected ||
    !venueOwner.stripeConnectedAccountId
  )
    throw new AppError(400, 'Venue owner Stripe account not connected');

  let stripeBalance: any;
  try {
    stripeBalance = await stripe.balance.retrieve(
      {},
      { stripeAccount: venueOwner.stripeConnectedAccountId },
    );
  } catch (err: any) {
    throw new AppError(
      502,
      `Failed to retrieve Stripe balance: ${err?.message || err}`,
    );
  }

  const availableCents = stripeBalance.available.reduce(
    (sum: number, b: any) => sum + b.amount,
    0,
  );
  const requestedCents = Math.round(amount * 100);

  if (requestedCents <= 0) throw new AppError(400, 'Invalid withdraw amount');
  if (requestedCents > availableCents)
    throw new AppError(400, 'Insufficient available balance');

  let payout: any;
  try {
    payout = await stripe.payouts.create(
      {
        amount: requestedCents,
        currency,
      },
      {
        stripeAccount: venueOwner.stripeConnectedAccountId,
      },
    );
  } catch (err: any) {
    throw new AppError(
      502,
      `Failed to create Stripe payout: ${err?.message || err}`,
    );
  }

  return payout;
};

const PaymentService = {
  getVenueOwnerWallet,
  withdrawFromVenueOwner,
};

export default PaymentService;
