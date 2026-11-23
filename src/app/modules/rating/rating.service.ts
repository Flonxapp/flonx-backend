import httpStatus from 'http-status';
import AppError from '../../error/appError';
import mongoose from 'mongoose';
import { ENUM_JOB_STATUS } from '../job/job.enum';
import { Job } from '../job/job.model';
import { Rating } from './rating.model';

const addRating = async (
  customerId: string,
  bartenderId: string,
  jobId: string,
  rating: number,
) => {
  // only the customer who posted the job may rate the bartender who took it
  if (
    !mongoose.Types.ObjectId.isValid(jobId) ||
    !mongoose.Types.ObjectId.isValid(bartenderId)
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid job or bartender id');
  }
  const job = await Job.findById(jobId).select('customer bartender status');
  if (
    !job ||
    String(job.customer) !== String(customerId) ||
    String(job.bartender) !== String(bartenderId)
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only rate the bartender who worked your job',
    );
  }
  if (
    job.status === ENUM_JOB_STATUS.PENDING ||
    job.status === ENUM_JOB_STATUS.CANCELLED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You can rate the bartender once the job has been assigned',
    );
  }

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
