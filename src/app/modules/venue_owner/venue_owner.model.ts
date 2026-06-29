import { Schema, model } from 'mongoose';
import { IVenueOwnerDocument } from './venue_owner.interface';

const VenueOwnerSchema = new Schema<IVenueOwnerDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    profile_image: {
      type: String,
      default: '',
    },
    isVenueInfoProvided: {
      type: Boolean,
      default: false,
    },
    isStripeAccountConnected: {
      type: Boolean,
      default: false,
    },
    stripeConnectedAccountId: {
      type: String,
      default: '',
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

VenueOwnerSchema.index({ user: 1 });

export const VenueOwner = model<IVenueOwnerDocument>(
  'VenueOwner',
  VenueOwnerSchema,
);
