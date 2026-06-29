import { Types } from 'mongoose';

export interface ICategory {
  venueOwner: Types.ObjectId;
  venue: Types.ObjectId;
  name: string;
  isDeleted: boolean;
}
