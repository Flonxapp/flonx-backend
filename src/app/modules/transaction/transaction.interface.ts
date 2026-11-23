/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from 'mongoose';
import {
  TRANSACTION_DIRECTION,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from './transaction.enum';

export interface ITransaction {
  // neither set = platform record
  venueOwner?: Types.ObjectId | null;
  customer?: Types.ObjectId | null;
  order?: Types.ObjectId | null;

  type: TRANSACTION_TYPE;
  status: TRANSACTION_STATUS;
  direction: TRANSACTION_DIRECTION;

  amount: number; // always positive, see direction
  currency: string;

  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeTransferId?: string;
  stripePayoutId?: string;
  stripeRefundId?: string;

  stripeAccountId?: string;

  stripeEventId?: string;

  metadata?: Record<string, any>;

  description?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
