import { model, Schema } from 'mongoose';
import { IShiftRating } from './shift_rating.interface';

const shiftRatingSchema = new Schema<IShiftRating>(
  {
    venueOwner: {
      type: Schema.Types.ObjectId,
      ref: 'VenueOwner',
      required: true,
    },
    bartender: {
      type: Schema.Types.ObjectId,
      ref: 'Bartender',
      required: true,
    },
    shift: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
  },
);

// one rating per venue owner, bartender and shift
shiftRatingSchema.index(
  { venueOwner: 1, bartender: 1, shift: 1 },
  { unique: true },
);

export const ShiftRating = model<IShiftRating>(
  'ShiftRating',
  shiftRatingSchema,
);
