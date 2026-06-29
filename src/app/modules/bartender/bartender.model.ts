import { Document, model, Schema } from 'mongoose';
import { IBartender } from './bartender.interface';

interface IBartenderDocument extends IBartender, Document {}
const locationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
    },
  },
  { _id: false },
);
const BartenderSchema = new Schema<IBartenderDocument>(
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
      index: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      index: true,
    },
    profile_image: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    location: {
      type: locationSchema,
      // required: true,
      default: null,
    },
    experience: {
      type: Number,
      default: null,
    },
    bio: {
      type: String,
      default: '',
    },
    skills: {
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

BartenderSchema.index({ user: 1 });
BartenderSchema.index({ location: '2dsphere' });
export const Bartender = model<IBartenderDocument>(
  'Bartender',
  BartenderSchema,
);
