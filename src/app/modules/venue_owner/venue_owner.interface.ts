import { Document, Types } from 'mongoose';

export interface IVenueOwner {
  user: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  profile_image?: string;
  isVenueInfoProvided: boolean;
  isStripeAccountConnected: boolean;
  stripeConnectedAccountId: string;
  currentBalance: number;
  totalEarning: number;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IVenueOwnerDocument extends IVenueOwner, Document {}
