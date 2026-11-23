import { Types } from 'mongoose';
import { TWithdrawStatus } from './withdraw_request.enum';

export interface IWithdrawRequest {
  venueOwner: Types.ObjectId;
  amount: number;
  currency: string;
  status: TWithdrawStatus;
  note?: string;
  rejectReason?: string;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  processingStartedAt?: Date;
  approveAttempts: number;
  lastError?: string;
  stripeAccountId?: string;
  stripeTransferId?: string;
  reversedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
