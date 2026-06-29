/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import Stripe from 'stripe';
import config from '../config';
import StripeService from '../modules/stripe/stripe.service';
import {
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '../modules/transaction/transaction.enum';
import Transaction from '../modules/transaction/transaction.model';
import { VenueOwner } from '../modules/venue_owner/venue_owner.model';
import { errorLogger, logger } from '../shared/logger';

const stripe = new Stripe(config.stripe.stripe_secret_key as string);
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

    // Handle different event types
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account.details_submitted) {
          try {
            await StripeService.updateStripeConnectedAccountStatus(account.id);
          } catch (err) {
            console.error(
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

      case 'payout.created': {
        const payout = event.data.object as Stripe.Payout;
        const accountId = event.account;

        const venueOwner = await VenueOwner.findOne({
          stripeConnectedAccountId: accountId,
        }).select('_id');

        if (!venueOwner) {
          errorLogger.error('Venue Owner not found during payout.created', {
            accountId,
            payoutId: payout.id,
          });
          return res.status(200).send('Venue Owner not found');
        }

        try {
          await Transaction.create({
            venueOwner: venueOwner._id,
            type: TRANSACTION_TYPE.PAYOUT,
            amount: payout.amount / 100,
            status: TRANSACTION_STATUS.PENDING,
            stripePayoutId: payout.id,
            stripeEventId: event.id,
          });

          logger.info('payout.created transaction recorded', {
            payoutId: payout.id,
            venueOwnerId: venueOwner._id,
            amount: payout.amount / 100,
          });
        } catch (err: any) {
          if (err.code === 11000) {
            logger.info('payout.created already processed (duplicate key)', {
              eventId: event.id,
            });
            return res.status(200).send('Already processed');
          }
          throw err;
        }

        break;
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;

        const existing = await Transaction.findOne({
          stripePayoutId: payout.id,
        });

        if (!existing) {
          const accountId = event.account;

          const venueOwner = await VenueOwner.findOne({
            stripeConnectedAccountId: accountId,
          }).select('_id');

          if (!venueOwner) {
            errorLogger.error(
              'Venue Owner not found during payout.paid (no existing transaction)',
              {
                accountId,
                payoutId: payout.id,
              },
            );
            return res.status(200).send('Venue Owner not found');
          }

          await Transaction.findOneAndUpdate(
            { stripePayoutId: payout.id },
            {
              venueOwner: venueOwner._id,
              type: TRANSACTION_TYPE.PAYOUT,
              amount: payout.amount / 100,
              status: TRANSACTION_STATUS.COMPLETED,
              stripePayoutId: payout.id,
              stripeEventId: event.id,
            },
            { new: true },
          );

          logger.info(
            'payout.paid — created missing transaction and marked COMPLETED',
            {
              payoutId: payout.id,
              venueOwnerId: venueOwner._id,
            },
          );
        } else {
          existing.status = TRANSACTION_STATUS.COMPLETED;
          await existing.save();

          logger.info('payout.paid — existing transaction marked COMPLETED', {
            payoutId: payout.id,
            transactionId: existing._id,
          });
        }

        break;
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;

        const updated = await Transaction.findOneAndUpdate(
          { stripePayoutId: payout.id },
          { status: TRANSACTION_STATUS.FAILED },
          { new: true },
        );

        if (!updated) {
          errorLogger.error('payout.failed — no matching transaction found', {
            payoutId: payout.id,
          });
        } else {
          logger.info('payout.failed — transaction marked FAILED', {
            payoutId: payout.id,
            transactionId: updated._id,
          });
        }

        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).send('Success');
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

export default handleConnectedAccountWebhook;
