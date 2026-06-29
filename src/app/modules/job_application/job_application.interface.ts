import { Types } from 'mongoose';

export interface IJobApplication {
  job: Types.ObjectId;
  bartender: Types.ObjectId;
  isAccepted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
