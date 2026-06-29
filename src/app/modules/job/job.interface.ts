import { Types } from 'mongoose';
import { ENUM_JOB_CANCELLED_BY, ENUM_JOB_STATUS } from './job.enum';

export interface IJob {
  customer: Types.ObjectId;
  bartender: Types.ObjectId | null;
  title: string;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  startDateTime: Date;
  endDateTime: Date;
  hourlyRate: number;
  contactNumber: string;
  description: string;
  status: (typeof ENUM_JOB_STATUS)[keyof typeof ENUM_JOB_STATUS];
  cancelledBy?: (typeof ENUM_JOB_CANCELLED_BY)[keyof typeof ENUM_JOB_CANCELLED_BY];
  cancellationDate: Date | null;
  assignDate: Date | null;
  completedDate: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
