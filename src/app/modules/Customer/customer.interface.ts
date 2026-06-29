import { Types } from 'mongoose';

export interface ICustomer {
  user: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  profile_image?: string;
  isGuest: boolean;
  stripeCustomerId?: string;
  paymentMethods: string[];
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
