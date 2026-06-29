/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { appEventEmitter } from '../../events/eventEmitter';
import { ENUM_JOB_STATUS } from '../job/job.enum';
import { Job } from '../job/job.model';
import { JobApplication } from './job_application.model';
// 🍸 Apply Job (bartender)
const applyJob = async (bartenderId: string, jobId: string) => {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, 'Job not found');
  }

  const alreadyApplied = await JobApplication.findOne({
    job: jobId,
    bartender: bartenderId,
  });

  if (alreadyApplied) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You already applied for this job',
    );
  }

  const result = await JobApplication.create({
    job: new Types.ObjectId(jobId),
    bartender: new Types.ObjectId(bartenderId),
  });

  return result;
};

const acceptApplication = async (userId: string, applicationId: string) => {
  const application =
    await JobApplication.findById(applicationId).populate('job');

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, 'Application not found');
  }

  const job: any = application.job;

  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, 'Job not found');
  }

  if (job.customer.toString() !== userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You are not authorized');
  }

  if (application.isAccepted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Already accepted');
  }

  await Job.findByIdAndUpdate(job._id, {
    bartender: application.bartender,
    status: ENUM_JOB_STATUS.Assigned,
    assignDate: new Date(),
  });

  // mark application accepted
  application.isAccepted = true;
  await application.save();

  //  NOTIFICATIONS

  appEventEmitter.emit('job.application.accepted', {
    jobId: job._id,
    bartender: application.bartender,
    customer: job.customer,
  });

  return application;
};
// 📄 Get all applications for a job
const getApplicationsByJob = async (jobId: string) => {
  const result = await JobApplication.aggregate([
    {
      $match: { job: new mongoose.Types.ObjectId(jobId) },
    },

    {
      $lookup: {
        from: 'bartenders',
        localField: 'bartender',
        foreignField: '_id',
        as: 'bartender',
      },
    },
    { $unwind: '$bartender' },

    {
      $lookup: {
        from: 'ratings',
        let: { bartenderId: '$bartender._id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$bartender', '$$bartenderId'] } } },
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$rating' },
              totalRatingCount: { $sum: 1 },
            },
          },
        ],
        as: 'ratingStats',
      },
    },

    {
      $lookup: {
        from: 'jobs',
        let: { bartenderId: '$bartender._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$bartender', '$$bartenderId'] },
                  { $eq: ['$status', ENUM_JOB_STATUS.COMPLETED] },
                ],
              },
            },
          },
          { $count: 'totalCompletedJobs' },
        ],
        as: 'completedJobs',
      },
    },

    {
      $addFields: {
        'bartender.avgRating': {
          $ifNull: [{ $arrayElemAt: ['$ratingStats.avgRating', 0] }, 0],
        },
        'bartender.totalRatingCount': {
          $ifNull: [{ $arrayElemAt: ['$ratingStats.totalRatingCount', 0] }, 0],
        },
        'bartender.totalCompletedJobs': {
          $ifNull: [
            { $arrayElemAt: ['$completedJobs.totalCompletedJobs', 0] },
            0,
          ],
        },
      },
    },

    // 6️⃣ Cleanup temporary arrays
    {
      $project: {
        ratingStats: 0,
        completedJobs: 0,
      },
    },

    // 7️⃣ Sort by createdAt descending
    {
      $sort: { createdAt: -1 },
    },
  ]);

  return result;
};

const getMyApplications = async (bartenderId: string) => {
  const result = await JobApplication.find({
    bartender: bartenderId,
  })
    .populate('job')
    .sort({ createdAt: -1 });

  return result;
};

const getSingleJobApplication = async (id: string) => {
  const result = await JobApplication.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
      },
    },

    {
      $lookup: {
        from: 'bartenders',
        localField: 'bartender',
        foreignField: '_id',
        as: 'bartender',
      },
    },
    { $unwind: '$bartender' },

    {
      $lookup: {
        from: 'jobs',
        let: { bartenderId: '$bartender._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$bartender', '$$bartenderId'] },
                  { $eq: ['$status', ENUM_JOB_STATUS.COMPLETED] },
                ],
              },
            },
          },
          { $count: 'totalCompletedJobs' },
        ],
        as: 'completedJobs',
      },
    },

    {
      $lookup: {
        from: 'ratings',
        let: { bartenderId: '$bartender._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$bartender', '$$bartenderId'],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$rating' },
              totalRatingCount: { $sum: 1 },
            },
          },
        ],
        as: 'ratingStats',
      },
    },

    {
      $addFields: {
        'bartender.totalCompletedJobs': {
          $ifNull: [
            { $arrayElemAt: ['$completedJobs.totalCompletedJobs', 0] },
            0,
          ],
        },
        'bartender.avgRating': {
          $ifNull: [{ $arrayElemAt: ['$ratingStats.avgRating', 0] }, 0],
        },
        'bartender.totalRatingCount': {
          $ifNull: [{ $arrayElemAt: ['$ratingStats.totalRatingCount', 0] }, 0],
        },
      },
    },

    {
      $project: {
        completedJobs: 0,
        ratingStats: 0,
      },
    },
  ]);

  return result[0];
};

const cancelApplication = async (bartenderId: string, jobId: string) => {
  const jobApplication = await JobApplication.findOne({
    bartender: bartenderId,
    job: jobId,
  });
  if (!jobApplication) {
    throw new AppError(httpStatus.NOT_FOUND, 'Application not found');
  }

  const result = await JobApplication.findOneAndDelete({
    bartender: bartenderId,
    job: jobId,
  });
  return result;
};

const JobApplicationService = {
  applyJob,
  acceptApplication,
  getApplicationsByJob,
  getMyApplications,
  cancelApplication,
  getSingleJobApplication,
};

export default JobApplicationService;
