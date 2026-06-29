import { model, Schema } from 'mongoose';
import { ENUM_JOB_CANCELLED_BY, ENUM_JOB_STATUS } from './job.enum';
import { IJob } from './job.interface';

const JobSchema = new Schema<IJob>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    bartender: {
      type: Schema.Types.ObjectId,
      ref: 'Bartender',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: function (val: number[]) {
            return val.length === 2;
          },
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
    },
    startDateTime: {
      type: Date,
      required: true,
    },
    endDateTime: {
      type: Date,
      required: true,
    },
    hourlyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ENUM_JOB_STATUS),
      default: ENUM_JOB_STATUS.PENDING,
    },
    cancelledBy: {
      type: String,
      enum: Object.values(ENUM_JOB_CANCELLED_BY),
      default: null,
    },
    cancellationDate: {
      type: Date,
      default: null,
    },
    assignDate: {
      type: Date,
      default: null,
    },
    completedDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

JobSchema.index({ location: '2dsphere' });

export const Job = model<IJob>('Job', JobSchema);
