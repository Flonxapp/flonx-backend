import { model, Schema } from 'mongoose';
import {
  deriveTransactionDirection,
  TRANSACTION_DIRECTION,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from './transaction.enum';
import { ITransaction } from './transaction.interface';

const transactionSchema = new Schema<ITransaction>(
  {
    venueOwner: {
      type: Schema.Types.ObjectId,
      ref: 'VenueOwner',
      default: null,
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },

    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },

    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPE),
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.PENDING,
    },

    direction: {
      type: String,
      enum: Object.values(TRANSACTION_DIRECTION),
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: 'usd',
      lowercase: true,
    },

    stripePaymentIntentId: { type: String },
    stripeChargeId: { type: String },
    stripeTransferId: { type: String },
    stripePayoutId: { type: String },
    stripeRefundId: { type: String },
    stripeAccountId: { type: String },

    stripeEventId: {
      type: String,
      unique: true,
      sparse: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// set direction from type and reason when it's missing
transactionSchema.pre('validate', function (next) {
  if (!this.direction) {
    this.direction = deriveTransactionDirection(
      this.type,
      this.metadata?.reason,
    );
  }
  next();
});

transactionSchema.index({ venueOwner: 1, createdAt: -1 });
transactionSchema.index({ customer: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ order: 1, type: 1 });
transactionSchema.index({ stripePaymentIntentId: 1 });
transactionSchema.index({ stripeTransferId: 1 });
transactionSchema.index({ stripePayoutId: 1 });
transactionSchema.index({ stripeRefundId: 1 });

const Transaction = model<ITransaction>('Transaction', transactionSchema);
export default Transaction;
