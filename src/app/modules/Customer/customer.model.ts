import { Schema, model } from 'mongoose';
import { ICustomer } from './customer.interface';

const CustomerSchema = new Schema<ICustomer>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      default: 'Guest User',
    },
    email: {
      type: String,
      sparse: true,
    },
    phone: {
      type: String,
      sparse: true,
    },
    profile_image: {
      type: String,
      default: '',
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    stripeCustomerId: {
      type: String,
      sparse: true,
      default: null,
    },
    paymentMethods: {
      type: [String],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

CustomerSchema.index({ user: 1 });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
