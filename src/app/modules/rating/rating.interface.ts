import { Types } from 'mongoose';

export interface IRating {
  customer: Types.ObjectId;
  bartender: Types.ObjectId;
  job: Types.ObjectId;
  rating: number;
}
