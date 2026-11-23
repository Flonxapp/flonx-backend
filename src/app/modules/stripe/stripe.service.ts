/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../../error/appError';
import stripe from '../../utilities/stripe';
import { createOnboardingLink } from '../../utilities/onboardingLink';
import { VenueOwner } from '../venue_owner/venue_owner.model';
import { errorLogger } from '../../shared/logger';

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
    return createOnboardingLink(venueOwner.stripeConnectedAccountId.toString());
  } else {
    const account = await stripe.accounts.create({
      type: 'express',
      email: venueOwner.email,
      country: 'US',
      capabilities: {
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: config.wallet.connected_account_payout_interval,
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
    return createOnboardingLink(account.id);
  }
};

const updateOnboardingLink = async (userData: JwtPayload) => {
  const user = await VenueOwner.findById(userData.profileId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Venue owner not found');
  }
  if (!user.stripeConnectedAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Stripe is not connected yet. Please connect Stripe first',
    );
  }
  // returns the URL string, same shape as create-onboarding-link
  return createOnboardingLink(user.stripeConnectedAccountId.toString());
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

    throw new AppError(
      httpStatus.NOT_FOUND,
      `No venue owner found with Stripe account ID: ${accountId}`,
    );
  } catch (err) {
    errorLogger.error('Error updating Stripe account status:', err);
    return {
      success: false,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'An error occurred while updating the client status.',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
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

    await stripe.paymentMethods.detach(paymentMethodId);
    return {
      success: true,
      message: 'Payment method detached successfully.',
    };
  } catch (error: any) {
    errorLogger.error('detachPaymentMethod error:', error);

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
  detachPaymentMethod,
};

export default StripeService;
