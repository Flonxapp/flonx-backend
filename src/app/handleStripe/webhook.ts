/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import Stripe from 'stripe';
import config from '../config';
import OrderRefundService from '../modules/order/order.refund.service';
import StripeService from '../modules/stripe/stripe.service';
import {
  ENUM_TRANSACTION_REASON,
  TRANSACTION_DIRECTION,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '../modules/transaction/transaction.enum';
import Transaction from '../modules/transaction/transaction.model';
import { VenueOwner } from '../modules/venue_owner/venue_owner.model';
import WithdrawRequestService from '../modules/withdraw_request/withdraw_request.service';
import { errorLogger, logger } from '../shared/logger';
import { handlePaymentSuccess } from './handlePaymentSuccess';

const stripe = new Stripe(config.stripe.stripe_secret_key as string);
const handleWebhook = async (req: Request, res: Response) => {
  const endpointSecret = config.stripe.webhook_endpoint_secret as string;
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      endpointSecret,
    );
    logger.info(`Received Stripe webhook: ${event.type}`, { id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const paymentIntentId = session.payment_intent;

        const paymentIntent = await stripe.paymentIntents.retrieve(
          paymentIntentId as string,
        );

        await handlePaymentSuccess(
          session.metadata,
          paymentIntent.id,
          paymentIntent.amount / 100,
        );

        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata;
        const paymentMethodId: any = paymentIntent?.payment_method;
        const customerId = paymentIntent.customer;
        await handlePaymentSuccess(
          metadata,
          paymentIntent.id,
          paymentIntent.amount / 100,
        );

        break;
      }
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

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;

        // withdrawal transfer: finish the request (no-op if already done)
        if (transfer.metadata?.withdrawRequestId) {
          await WithdrawRequestService.finalizeApprovedTransfer(
            transfer.metadata.withdrawRequestId,
            transfer,
          );
          break;
        }

        const venueOwner = await VenueOwner.findOne({
          stripeConnectedAccountId: transfer.destination,
        }).select('_id');

        if (!venueOwner) {
          errorLogger.error('Venue owner not found during transfer.created', {
            destination: transfer.destination,
            transferId: transfer.id,
          });
          return res.status(200).send('Venue owner not found');
        }

        // transfer made outside the app, recorded only, wallet not touched
        try {
          await Transaction.create({
            venueOwner: venueOwner._id,
            type: TRANSACTION_TYPE.TRANSFER,
            direction: TRANSACTION_DIRECTION.NONE,
            amount: transfer.amount / 100,
            currency: transfer.currency,
            status: TRANSACTION_STATUS.COMPLETED,
            stripeTransferId: transfer.id,
            stripeAccountId: transfer.destination as string,
            stripeEventId: event.id,
            description: 'Transfer made outside the app',
            metadata: {
              ...transfer.metadata,
              reason: ENUM_TRANSACTION_REASON.MANUAL_TRANSFER,
            },
          });

          logger.info('manual transfer.created transaction recorded', {
            transferId: transfer.id,
            venueOwnerId: venueOwner._id,
          });
        } catch (err: any) {
          if (err.code === 11000) {
            logger.info('transfer.created already processed (duplicate key)', {
              eventId: event.id,
            });
            return res.status(200).send('Already processed');
          }
          throw err;
        }

        break;
      }
      case 'refund.updated':
      case 'charge.refund.updated': {
        const refund = event.data.object as Stripe.Refund;
        await OrderRefundService.handleRefundUpdated(refund);
        break;
      }
      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer;
        await WithdrawRequestService.handleTransferReversed(transfer);
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

export default handleWebhook;
