/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import Stripe from 'stripe';
import config from '../config';
import StripeService from '../modules/stripe/stripe.service';
import {
  TRANSACTION_DIRECTION,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '../modules/transaction/transaction.enum';
import Transaction from '../modules/transaction/transaction.model';
import { VenueOwner } from '../modules/venue_owner/venue_owner.model';
import { errorLogger, logger } from '../shared/logger';

const stripe = new Stripe(config.stripe.stripe_secret_key as string);

// Upsert by payout id, so repeated or out-of-order events don't create
// duplicates or move a finished payout back to PENDING.
const recordPayout = async (
  event: Stripe.Event,
  status: TRANSACTION_STATUS,
) => {
  const payout = event.data.object as Stripe.Payout;
  const accountId = event.account;

  const venueOwner = await VenueOwner.findOne({
    stripeConnectedAccountId: accountId,
  }).select('_id');
  if (!venueOwner) {
    errorLogger.error(`Venue owner not found for ${event.type}`, {
      accountId,
      payoutId: payout.id,
    });
    return;
  }

  const isFinal = status !== TRANSACTION_STATUS.PENDING;
  await Transaction.findOneAndUpdate(
    { stripePayoutId: payout.id },
    {
      $setOnInsert: {
        venueOwner: venueOwner._id,
        type: TRANSACTION_TYPE.PAYOUT,
        direction: TRANSACTION_DIRECTION.NONE,
        amount: payout.amount / 100,
        currency: payout.currency,
        stripePayoutId: payout.id,
        stripeAccountId: accountId,
        description: 'Payout from Stripe account to bank',
        ...(isFinal ? {} : { status }),
      },
      ...(isFinal
        ? {
            $set: {
              status,
              'metadata.arrivalDate': payout.arrival_date
                ? new Date(payout.arrival_date * 1000)
                : null,
              ...(payout.failure_message
                ? { 'metadata.failureMessage': payout.failure_message }
                : {}),
            },
          }
        : {}),
    },
    { upsert: true, new: true, runValidators: true },
  );

  logger.info(`${event.type} recorded`, {
    payoutId: payout.id,
    venueOwnerId: venueOwner._id,
    status,
  });
};
const handleConnectedAccountWebhook = async (req: Request, res: Response) => {
  const endpointSecret = config.stripe
    .webhook_endpoint_secret_for_connected as string;

  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      endpointSecret,
    );
    logger.info(`Received Stripe connected account webhook: ${event.type}`, {
      id: event.id,
    });

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account.details_submitted) {
          try {
            await StripeService.updateStripeConnectedAccountStatus(account.id);
          } catch (err) {
            errorLogger.error(
              `Failed to update client status for Stripe account ID: ${account.id}`,
              err,
            );
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId, subscriptionId } = paymentIntent.metadata;

        break;
      }

      // payouts to the venue owner's bank, for the record only
      case 'payout.created': {
        await recordPayout(event, TRANSACTION_STATUS.PENDING);
        break;
      }
      case 'payout.paid': {
        await recordPayout(event, TRANSACTION_STATUS.COMPLETED);
        break;
      }
      case 'payout.failed':
      case 'payout.canceled': {
        await recordPayout(
          event,
          event.type === 'payout.failed'
            ? TRANSACTION_STATUS.FAILED
            : TRANSACTION_STATUS.CANCELED,
        );
        break;
      }

      default:
        logger.info(`Unhandled event type ${event.type}`);
    }

    res.status(200).send('Success');
  } catch (err: any) {
    errorLogger.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

export default handleConnectedAccountWebhook;
