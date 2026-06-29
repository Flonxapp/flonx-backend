import { Document, model, Schema } from 'mongoose';
import { IVenue } from './venue.interface';

interface IVenueDocument extends IVenue, Document {}

const VenueSchema = new Schema<IVenueDocument>(
  {
    venueOwner: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'VenueOwner',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      index: true,
    },
    qrCodeUrl: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    logo: {
      type: String,
      default: '',
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

VenueSchema.index({ location: '2dsphere' });

export const Venue = model<IVenueDocument>('Venue', VenueSchema);
