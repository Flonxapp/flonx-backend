import httpStatus from 'http-status';
import AppError from '../../error/appError';
import mongoose from 'mongoose';
import { ENUM_SHIFT_STATUS } from '../shift/shift.enum';
import { Shift } from '../shift/shift.model';
import { ShiftRating } from './shift_rating.model';

const addRating = async (
  venueOwnerId: string,
  bartenderId: string,
  shiftId: string,
  rating: number,
) => {
  // only the venue owner of the shift may rate the bartender who worked it
  if (
    !mongoose.Types.ObjectId.isValid(shiftId) ||
    !mongoose.Types.ObjectId.isValid(bartenderId)
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid shift or bartender id');
  }
  const shift = await Shift.findById(shiftId).select(
    'venueOwner bartender status',
  );
  if (
    !shift ||
    String(shift.venueOwner) !== String(venueOwnerId) ||
    String(shift.bartender) !== String(bartenderId)
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only rate the bartender who worked your shift',
    );
  }
  if (
    shift.status !== ENUM_SHIFT_STATUS.Active &&
    shift.status !== ENUM_SHIFT_STATUS.Completed
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You can rate the bartender once the shift has started',
    );
  }

  const existingRating = await ShiftRating.findOne({
    venueOwner: venueOwnerId,
    bartender: bartenderId,
    shift: shiftId,
  });
  if (existingRating) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have already rated this bartender for this job',
    );
  }
  const result = await ShiftRating.create({
    venueOwner: venueOwnerId,
    bartender: bartenderId,
    shift: shiftId,
    rating,
  });
  return result;
};

const ShiftRatingService = {
  addRating,
};

export default ShiftRatingService;
