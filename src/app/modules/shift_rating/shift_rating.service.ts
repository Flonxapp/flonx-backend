import httpStatus from 'http-status';
import AppError from '../../error/appError';
import { ShiftRating } from './shift_rating.model';

const addRating = async (
  venueOwnerId: string,
  bartenderId: string,
  shiftId: string,
  rating: number,
) => {
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
