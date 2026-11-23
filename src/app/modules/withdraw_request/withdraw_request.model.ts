import { model, Schema } from 'mongoose';
import { ENUM_WITHDRAW_STATUS } from './withdraw_request.enum';
import { IWithdrawRequest } from './withdraw_request.interface';

const withdrawRequestSchema = new Schema<IWithdrawRequest>(
  {
    venueOwner: {
      type: Schema.Types.ObjectId,
      ref: 'VenueOwner',
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'usd' },
    status: {
      type: String,
      enum: Object.values(ENUM_WITHDRAW_STATUS),
      default: ENUM_WITHDRAW_STATUS.PENDING,
    },
    note: { type: String, trim: true, maxlength: 500 },
    rejectReason: { type: String, trim: true, maxlength: 1000 },
    processedBy: { type: Schema.Types.ObjectId, ref: 'SuperAdmin' },
    processedAt: { type: Date },
    processingStartedAt: { type: Date },
    approveAttempts: { type: Number, default: 0 },
    lastError: { type: String },
    stripeAccountId: { type: String },
    stripeTransferId: { type: String },
    reversedAt: { type: Date },
  },
  { timestamps: true },
);

withdrawRequestSchema.index({ venueOwner: 1, createdAt: -1 });
withdrawRequestSchema.index({ status: 1, createdAt: -1 });
withdrawRequestSchema.index({ stripeTransferId: 1 }, { sparse: true });

export const WithdrawRequest = model<IWithdrawRequest>(
  'WithdrawRequest',
  withdrawRequestSchema,
);
