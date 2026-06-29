/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../../config';
import AppError from '../../error/appError';
import stripe from '../../utilities/stripe';
import {
  ENUM_TRANSACTION_REASON,
  TRANSACTION_TYPE,
} from '../transaction/transaction.enum';
import Transaction from '../transaction/transaction.model';
import { VenueOwner } from '../venue_owner/venue_owner.model';

const createConnectedAccountAndOnboardingLink = async (
  userData: JwtPayload,
) => {
  const venueOwner = await VenueOwner.findById(userData.profileId);
  if (!venueOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Venue owner not found');
  }
  if (venueOwner?.isStripeAccountConnected) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Stripe is already connected');
  }
  if (venueOwner.stripeConnectedAccountId) {
    const onboardingLink = await stripe.accountLinks.create({
      account: venueOwner.stripeConnectedAccountId.toString(),
      refresh_url: `${config.stripe.onboarding_refresh_url}?accountId=${venueOwner.stripeConnectedAccountId.toString()}`,
      return_url: `${config.stripe.onboarding_return_url}`,
      type: 'account_onboarding',
    });
    return onboardingLink.url;
  } else {
    const account = await stripe.accounts.create({
      type: 'express',
      email: venueOwner.email,
      country: 'US',
      capabilities: {
        // card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'manual',
          },
        },
      },
    });
    const updateVenueOwnerData = await VenueOwner.findByIdAndUpdate(
      userData.profileId,
      {
        stripeConnectedAccountId: account?.id,
      },
    );
    if (!updateVenueOwnerData) {
      throw new AppError(
        httpStatus.SERVICE_UNAVAILABLE,
        'Unable to add account id in reviewer data',
      );
    }
    const onboardingLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${config.stripe.onboarding_refresh_url}?accountId=${account?.id}`,
      return_url: `${config.stripe.onboarding_return_url}`,
      type: 'account_onboarding',
    });
    return onboardingLink.url;
  }
};

const updateOnboardingLink = async (userData: JwtPayload) => {
  const user = await VenueOwner.findById(userData.profileId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Venue owner not found');
  }
  const accountLink = await stripe.accountLinks.create({
    account: user.stripeConnectedAccountId.toString(),
    refresh_url: `${config.stripe.onboarding_refresh_url}?accountId=${user.stripeConnectedAccountId}`,
    return_url: config.stripe.onboarding_return_url,
    type: 'account_onboarding',
  });

  return { link: accountLink.url };
};

const updateStripeConnectedAccountStatus = async (accountId: string) => {
  if (!accountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Stripe account ID is required.',
    );
  }

  try {
    const updatedVenueOwner = await VenueOwner.findOneAndUpdate(
      { stripeConnectedAccountId: accountId },
      { isStripeAccountConnected: true },
      { new: true, runValidators: true },
    );

    if (updatedVenueOwner) {
      return {
        success: true,
        message: 'Reviewer Stripe account connected successfully.',
        data: updatedVenueOwner,
      };
    }

    // If neither found
    throw new AppError(
      httpStatus.NOT_FOUND,
      `No venue owner found with Stripe account ID: ${accountId}`,
    );
  } catch (err) {
    console.error('Error updating Stripe account status:', err);
    return {
      success: false,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'An error occurred while updating the client status.',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};
const withdrawMoney = async (userData: JwtPayload, amount: number) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const amountInCent = Math.round(amount * 100);

    const venueOwner = await VenueOwner.findById(userData.profileId).session(
      session,
    );
    if (!venueOwner) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (venueOwner.currentBalance < amount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You don't have enough balance",
      );
    }

    if (!venueOwner.isStripeAccountConnected) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'For withdraw you need to connect your bank info with Stripe',
      );
    }

    const stripe_account_id: any = venueOwner.stripeConnectedAccountId;
    if (!stripe_account_id) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Stripe account not found');
    }

    // ---------- STRIPE TRANSFER ----------
    const transfer = await stripe.transfers.create({
      amount: amountInCent,
      currency: 'usd',
      destination: stripe_account_id,
    });

    // ---------- STRIPE PAYOUT ----------
    const payout = await stripe.payouts.create(
      {
        amount: amountInCent,
        currency: 'usd',
      },
      {
        stripeAccount: stripe_account_id,
      },
    );

    await VenueOwner.findByIdAndUpdate(
      userData.profileId,
      {
        $inc: {
          currentBalance: -amount,
        },
      },
      { session },
    );

    // Record transfer and payout as transactions (pending until webhooks confirm)
    await Transaction.create(
      [
        {
          venueOwner: userData.profileId,
          type: TRANSACTION_TYPE.TRANSFER,
          status: 'PENDING',
          amount,
          stripeTransferId: transfer.id,
          metadata: { reason: ENUM_TRANSACTION_REASON.WITHDRAWAL },
        },
        {
          venueOwner: userData.profileId,
          type: TRANSACTION_TYPE.PAYOUT,
          status: 'PENDING',
          amount,
          stripePayoutId: payout.id,
          metadata: { reason: ENUM_TRANSACTION_REASON.WITHDRAWAL },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return { transfer, payout };
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      httpStatus.BAD_REQUEST,
      error.message || 'Withdrawal failed. Update your bank info.',
    );
  }
};

const detachPaymentMethod = async (paymentIntentId: string) => {
  try {
    if (!paymentIntentId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payment detach failed: paymentIntentId and orderId are required.',
      );
    }

    const paymentIntent: any = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ['payment_method'],
      },
    );

    if (!paymentIntent) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Payment detach failed: PaymentIntent not found in Stripe.',
      );
    }

    const paymentMethodId = paymentIntent.payment_method?.id;

    if (!paymentMethodId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payment detach failed: No payment method found in this payment intent.',
      );
    }

    // =========================
    // 3. GET ORDER + CUSTOMER
    // =========================
    // const order: any = await Order.findById(orderId).populate(
    //   'customer',
    //   'stripeCustomerId',
    // );

    // if (!order) {
    //   throw new AppError(
    //     httpStatus.NOT_FOUND,
    //     'Payment save failed: Order not found.',
    //   );
    // }

    // const stripeCustomerId = order?.customer?.stripeCustomerId;

    // if (!stripeCustomerId) {
    //   throw new AppError(
    //     httpStatus.BAD_REQUEST,
    //     'Payment save failed: Stripe customer not found for this user.',
    //   );
    // }

    // console.log('detaching payment method from customer:', {
    //   paymentMethodId,
    //   stripeCustomerId,
    // });
    const detached = await stripe.paymentMethods.detach(paymentMethodId);
    console.log('Detached payment method:', detached);
    return {
      success: true,
      message: 'Payment method detached successfully.',
    };
  } catch (error: any) {
    console.error('detachPaymentMethod error:', error);

    // Stripe specific error handling
    if (error?.type === 'StripeInvalidRequestError') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        error.message ||
          'Stripe request failed while detaching payment method.',
      );
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to detach payment information.',
    );
  }
};

const StripeService = {
  createConnectedAccountAndOnboardingLink,
  updateOnboardingLink,
  updateStripeConnectedAccountStatus,
  withdrawMoney,
  detachPaymentMethod,
};

export default StripeService;
