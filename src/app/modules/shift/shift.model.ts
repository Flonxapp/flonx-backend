import { model, Schema } from 'mongoose';
import { ENUM_SHIFT_STATUS } from './shift.enum';
import { IShift } from './shift.interface';

const shiftRequestSchema = new Schema<IShift>(
  {
    venueOwner: {
      type: Schema.Types.ObjectId,
      ref: 'VenueOwner',
      required: true,
    },
    venue: {
      type: Schema.Types.ObjectId,
      ref: 'Venue',
      required: true,
    },
    bartender: {
      type: Schema.Types.ObjectId,
      ref: 'Bartender',
      required: true,
    },
    startDateTime: {
      type: Date,
      required: true,
    },
    endDateTime: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ENUM_SHIFT_STATUS),
      default: ENUM_SHIFT_STATUS.Requested,
    },
    shiftRate: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// active shift lookup on every order, overlap checks, and the status cron
shiftRequestSchema.index({ venue: 1, status: 1, startDateTime: 1 });
shiftRequestSchema.index({ bartender: 1, status: 1, startDateTime: 1 });
shiftRequestSchema.index({ venueOwner: 1, status: 1, startDateTime: -1 });
shiftRequestSchema.index({ status: 1, startDateTime: 1 });
shiftRequestSchema.index({ status: 1, endDateTime: 1 });

export const Shift = model<IShift>('Shift', shiftRequestSchema);
