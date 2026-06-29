/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import Stripe from 'stripe';
import config from '../config';
import { Order } from '../modules/order/order.model';
import StripeService from '../modules/stripe/stripe.service';
import {
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '../modules/transaction/transaction.enum';
import Transaction from '../modules/transaction/transaction.model';
import { VenueOwner } from '../modules/venue_owner/venue_owner.model';
import { errorLogger, logger } from '../shared/logger';
import { handlePaymentSuccess } from './handlePaymentSuccess';

const stripe = new Stripe(config.stripe.stripe_secret_key as string);
const handleWebhook = async (req: Request, res: Response) => {
  console.log('Received Stripe Webhook:', req.body);
  const endpointSecret = config.stripe.webhook_endpoint_secret as string;
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      endpointSecret,
    );

    // Handle different event types
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
        console.log('PaymentIntent succeeded:', paymentIntent);
        // If you stored metadata while creating PaymentIntent
        const metadata = paymentIntent.metadata;
        const paymentMethodId: any = paymentIntent?.payment_method;
        console.log('PaymentIntent succeeded with metadata:', paymentIntent);
        const customerId = paymentIntent.customer;
        await handlePaymentSuccess(
          metadata,
          paymentIntent.id,
          paymentIntent.amount / 100,
          // paymentMethodId,
        );

        break;
      }
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

      // handleWebhook.ts — transfer.created case
      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;

        console.log('transfer =======>', transfer);

        console.log('eventid', event.id);

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

        try {
          const createTransfer = await Transaction.create({
            venueOwner: venueOwner._id,
            type: TRANSACTION_TYPE.TRANSFER,
            amount: transfer.amount / 100,
            status: TRANSACTION_STATUS.COMPLETED,
            stripeTransferId: transfer.id,
            stripeEventId: event.id,
            metadata: transfer.metadata,
          });

          console.log('transaction', createTransfer);

          // mark the order so pending balance calc is correct
          if (transfer.metadata?.taskId) {
            await Order.findByIdAndUpdate(transfer.metadata.taskId, {
              isTransferSent: true,
            });
          }

          errorLogger.info('transfer.created transaction recorded', {
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
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).send('Success');
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

export default handleWebhook;
