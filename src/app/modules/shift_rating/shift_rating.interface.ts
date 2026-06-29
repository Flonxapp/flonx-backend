import { Types } from 'mongoose';

export interface IShiftRating {
  venueOwner: Types.ObjectId;
  bartender: Types.ObjectId;
  shift: Types.ObjectId;
  rating: number;
}
