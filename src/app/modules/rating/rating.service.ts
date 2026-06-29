import httpStatus from 'http-status';
import AppError from '../../error/appError';
import { Rating } from './rating.model';

const addRating = async (
  customerId: string,
  bartenderId: string,
  jobId: string,
  rating: number,
) => {
  const existingRating = await Rating.findOne({
    customer: customerId,
    bartender: bartenderId,
    job: jobId,
  });
  if (existingRating) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have already rated this bartender for this job',
    );
  }
  const result = await Rating.create({
    customer: customerId,
    bartender: bartenderId,
    job: jobId,
    rating,
  });
  return result;
};

const RatingService = {
  addRating,
};

export default RatingService;
