import { Types } from 'mongoose';
import { ENUM_SHIFT_STATUS } from './shift.enum';

export interface IShift {
  venueOwner: Types.ObjectId;
  venue: Types.ObjectId;
  bartender: Types.ObjectId;
  startDateTime: Date;
  endDateTime: Date;
  note?: string;
  status: (typeof ENUM_SHIFT_STATUS)[keyof typeof ENUM_SHIFT_STATUS];
  shiftRate: number;
}
