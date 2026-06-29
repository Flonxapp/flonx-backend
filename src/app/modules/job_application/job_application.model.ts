import { model, Schema } from 'mongoose';
import { IJobApplication } from './job_application.interface';

const JobApplicationSchema = new Schema<IJobApplication>(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    bartender: {
      type: Schema.Types.ObjectId,
      ref: 'Bartender',
      required: true,
    },
    isAccepted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

JobApplicationSchema.index({ job: 1, bartender: 1 }, { unique: true });

export const JobApplication = model<IJobApplication>(
  'JobApplication',
  JobApplicationSchema,
);
