/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { appEventEmitter } from '../../events/eventEmitter';
import { JobApplication } from '../job_application/job_application.model';
import { USER_ROLE } from '../user/user.constant';
import { CreateJobDTO, UpdateJobDTO } from './job.dto';
import { ENUM_JOB_CANCELLED_BY, ENUM_JOB_STATUS } from './job.enum';
import { Job } from './job.model';

const createJob = async (userId: string, payload: CreateJobDTO) => {
  const start = new Date(payload.startDateTime);
  const end = new Date(payload.endDateTime);

  if (end <= start) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'End date time must be greater than start date time',
    );
  }

  const jobData = {
    ...payload,
    customer: new Types.ObjectId(userId),
    startDateTime: start,
    endDateTime: end,
  };

  const result = await Job.create(jobData);

  appEventEmitter.emit('job.created', {
    jobId: result._id,
    customer: userId,
  });
  return result;
};

const updateJob = async (
  userId: string,
  jobId: string,
  payload: UpdateJobDTO,
) => {
  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, 'Job not found');
  }

  if (job.customer.toString() !== userId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You are not allowed to update this job',
    );
  }

  let start = job.startDateTime;
  let end = job.endDateTime;

  if (payload.startDateTime) {
    start = new Date(payload.startDateTime);
    payload.startDateTime = start as any;
  }

  if (payload.endDateTime) {
    end = new Date(payload.endDateTime);
    payload.endDateTime = end as any;
  }

  if (start && end && end <= start) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'End date time must be greater than start date time',
    );
  }

  const result = await Job.findByIdAndUpdate(jobId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const getAllJobsFromDB = async (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const searchTerm = query.searchTerm || '';
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const maxDistance = Number(query.maxDistance) * 1000 || 5000;

  const filters: any = {};

  Object.keys(query).forEach((key) => {
    if (
      !['searchTerm', 'page', 'limit', 'lat', 'lng', 'maxDistance'].includes(
        key,
      )
    ) {
      filters[key] = query[key];
    }
  });

  const searchMatchStage = searchTerm
    ? {
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { address: { $regex: searchTerm, $options: 'i' } },
        ],
      }
    : {};

  const pipeline: any[] = [];
  // 📍 Geo search
  if (!isNaN(lat) && !isNaN(lng)) {
    pipeline.push({
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        key: 'location',
        distanceField: 'distance',
        maxDistance: maxDistance,
        query: { ...filters, ...searchMatchStage },
        spherical: true,
      },
    });
  } else {
    pipeline.push({
      $match: { ...filters, ...searchMatchStage },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'customers',
        localField: 'customer',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: '$customer' },

    {
      $lookup: {
        from: 'bartenders',
        localField: 'bartender',
        foreignField: '_id',
        as: 'bartender',
      },
    },
    {
      $unwind: {
        path: '$bartender',
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $project: {
        title: 1,
        address: 1,
        location: 1,
        startDateTime: 1,
        endDateTime: 1,
        hourlyRate: 1,
        contactNumber: 1,
        description: 1,
        status: 1,
        distance: 1,
        assignDate: 1,
        cancelledBy: 1,
        cancellationDate: 1,
        completedDate: 1,
        customer: {
          name: 1,
          email: 1,
          profile_image: 1,
        },
        bartender: {
          name: 1,
          email: 1,
          profile_image: 1,
        },
      },
    },

    {
      $sort: !isNaN(lat) && !isNaN(lng) ? { distance: 1 } : { createdAt: -1 },
    },

    {
      $facet: {
        result: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'total' }],
      },
    },
  );

  const aggResult = await Job.aggregate(pipeline);

  const result = aggResult[0]?.result || [];
  const total = aggResult[0]?.totalCount[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
    result,
  };
};

// const getSingleJob = async (jobId: string, userData: any) => {
//   if (!mongoose.Types.ObjectId.isValid(jobId)) {
//     throw new Error('Invalid Job ID');
//   }

//   const isBartender = userData?.role === 'bartender';
//   const bartenderId = userData?.profileId;
//   const pipeline: any[] = [
//     {
//       $match: {
//         _id: new mongoose.Types.ObjectId(jobId),
//       },
//     },

//     {
//       $lookup: {
//         from: 'customers',
//         localField: 'customer',
//         foreignField: '_id',
//         as: 'customer',
//       },
//     },
//     { $unwind: '$customer' },

//     {
//       $lookup: {
//         from: 'bartenders',
//         localField: 'bartender',
//         foreignField: '_id',
//         as: 'bartender',
//       },
//     },
//     {
//       $unwind: {
//         path: '$bartender',
//         preserveNullAndEmptyArrays: true,
//       },
//     },
//   ];

//   if (isBartender && bartenderId) {
//     pipeline.push({
//       $lookup: {
//         from: 'jobapplications',
//         let: { jobId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ['$job', '$$jobId'] },
//                   {
//                     $eq: [
//                       '$bartender',
//                       new mongoose.Types.ObjectId(bartenderId),
//                     ],
//                   },
//                 ],
//               },
//             },
//           },
//         ],
//         as: 'applicationData',
//       },
//     });
//   }

//   pipeline.push(
//     {
//       $lookup: {
//         from: 'ratings',
//         let: { jobId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $eq: ['$job', '$$jobId'],
//               },
//             },
//           },
//           {
//             $project: {
//               rating: 1,
//             },
//           },
//         ],
//         as: 'ratingData',
//       },
//     },
//     {
//       $addFields: {
//         rating: {
//           $ifNull: [{ $arrayElemAt: ['$ratingData.rating', 0] }, 0],
//         },
//         ...(isBartender && bartenderId
//           ? {
//               applied: {
//                 $gt: [{ $size: '$applicationData' }, 0],
//               },
//               applyDate: {
//                 $arrayElemAt: ['$applicationData.createdAt', 0],
//               },
//             }
//           : {}),
//       },
//     },
//   );

//   pipeline.push({
//     $project: {
//       title: 1,
//       address: 1,
//       location: 1,
//       startDateTime: 1,
//       endDateTime: 1,
//       hourlyRate: 1,
//       contactNumber: 1,
//       description: 1,
//       status: 1,
//       rating: 1,
//       ...(isBartender && bartenderId ? { applied: 1 } : {}),
//       assignDate: 1,
//       cancelledBy: 1,
//       cancellationDate: 1,
//       completedDate: 1,
//       customer: {
//         _id: 1,
//         name: 1,
//         email: 1,
//         profile_image: 1,
//       },
//       bartender: {
//         _id: 1,
//         name: 1,
//         email: 1,
//         profile_image: 1,
//       },
//     },
//   });

//   const result = await Job.aggregate(pipeline);

//   return result[0] || null;
// };

const getSingleJob = async (jobId: string, userData: any) => {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new Error('Invalid Job ID');
  }

  const isBartender = userData?.role === 'bartender';
  const bartenderId = userData?.profileId;

  const pipeline: any[] = [
    {
      $match: {
        _id: new mongoose.Types.ObjectId(jobId),
      },
    },

    // Customer lookup
    {
      $lookup: {
        from: 'customers',
        localField: 'customer',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: '$customer' },

    // Bartender lookup
    {
      $lookup: {
        from: 'bartenders',
        localField: 'bartender',
        foreignField: '_id',
        as: 'bartender',
      },
    },
    {
      $unwind: {
        path: '$bartender',
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  // Application lookup (only for bartender)
  if (isBartender && bartenderId) {
    pipeline.push({
      $lookup: {
        from: 'jobapplications',
        let: { jobId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$job', '$$jobId'] },
                  {
                    $eq: [
                      '$bartender',
                      new mongoose.Types.ObjectId(bartenderId),
                    ],
                  },
                ],
              },
            },
          },
          {
            $project: {
              createdAt: 1,
            },
          },
        ],
        as: 'applicationData',
      },
    });
  }

  // Ratings lookup
  pipeline.push(
    {
      $lookup: {
        from: 'ratings',
        let: { jobId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$job', '$$jobId'],
              },
            },
          },
          {
            $project: {
              rating: 1,
            },
          },
        ],
        as: 'ratingData',
      },
    },

    // Add computed fields
    {
      $addFields: {
        rating: {
          $ifNull: [{ $arrayElemAt: ['$ratingData.rating', 0] }, 0],
        },

        ...(isBartender && bartenderId
          ? {
              applied: {
                $gt: [{ $size: '$applicationData' }, 0],
              },

              applyDate: {
                $ifNull: [
                  { $arrayElemAt: ['$applicationData.createdAt', 0] },
                  null,
                ],
              },
            }
          : {}),
      },
    },
  );

  // Final projection
  pipeline.push({
    $project: {
      title: 1,
      address: 1,
      location: 1,
      startDateTime: 1,
      endDateTime: 1,
      hourlyRate: 1,
      contactNumber: 1,
      description: 1,
      status: 1,
      rating: 1,
      ...(isBartender && bartenderId
        ? {
            applied: 1,
            applyDate: 1,
          }
        : {}),

      assignDate: 1,
      cancelledBy: 1,
      cancellationDate: 1,
      completedDate: 1,

      customer: {
        _id: 1,
        name: 1,
        email: 1,
        profile_image: 1,
      },

      bartender: {
        _id: 1,
        name: 1,
        email: 1,
        profile_image: 1,
      },
    },
  });

  const result = await Job.aggregate(pipeline);

  return result[0] || null;
};

type JobType = 'applied' | 'assigned' | 'completed' | 'all' | 'cancelled';

const getMyJobs = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  if (userData.role == USER_ROLE.bartender) {
    const userId = new Types.ObjectId(userData.profileId);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const searchTerm = (query.searchTerm as string) || '';
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    const maxDistance = Number(query.maxDistance)
      ? Number(query.maxDistance) * 1000
      : 5000;

    const type = (query.type as JobType) || 'all';

    // Build base filters
    const filters: Record<string, any> = {};

    Object.keys(query).forEach((key) => {
      if (
        ![
          'searchTerm',
          'page',
          'limit',
          'lat',
          'lng',
          'maxDistance',
          'type',
        ].includes(key)
      ) {
        filters[key] = query[key];
      }
    });

    const searchMatch = searchTerm
      ? {
          $or: [
            { title: { $regex: searchTerm, $options: 'i' } },
            { address: { $regex: searchTerm, $options: 'i' } },
          ],
        }
      : {};
    let appliedJobIds: Types.ObjectId[] = [];

    if (type === 'applied' || type === 'all') {
      const applications = await JobApplication.find({
        bartender: userId,
        isAccepted: false,
      })
        .select('job')
        .lean();

      appliedJobIds = applications.map((a) => a.job);
    }
    const jobFilters: Record<string, any> = { ...filters };

    if (type === 'assigned') {
      jobFilters.bartender = userId;
      jobFilters.status = { $ne: ENUM_JOB_STATUS.COMPLETED };
    } else if (type === 'completed') {
      jobFilters.bartender = userId;
      jobFilters.status = ENUM_JOB_STATUS.COMPLETED;
    } else if (type === 'applied') {
      jobFilters._id = { $in: appliedJobIds };
    } else if (type === 'cancelled') {
      jobFilters.status = ENUM_JOB_STATUS.CANCELLED;
    } else {
      jobFilters.$or = [{ bartender: userId }, { _id: { $in: appliedJobIds } }];
    }

    const pipeline: any[] = [];

    const hasGeo = !isNaN(lat) && !isNaN(lng) && type !== 'applied';

    if (hasGeo) {
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          key: 'location',
          distanceField: 'distance',
          maxDistance,
          query: { ...jobFilters, ...searchMatch },
          spherical: true,
        },
      });
    } else {
      pipeline.push({
        $match: { ...jobFilters, ...searchMatch },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'customers',
          localField: 'customer',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: '$customer' },

      {
        $lookup: {
          from: 'bartenders',
          localField: 'bartender',
          foreignField: '_id',
          as: 'bartender',
        },
      },
      {
        $unwind: {
          path: '$bartender',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          title: 1,
          address: 1,
          location: 1,
          startDateTime: 1,
          endDateTime: 1,
          hourlyRate: 1,
          contactNumber: 1,
          description: 1,
          status: 1,
          distance: 1,

          customer: {
            name: 1,
            email: 1,
            profile_image: 1,
          },
          bartender: {
            name: 1,
            email: 1,
            profile_image: 1,
          },
        },
      },

      {
        $sort: hasGeo ? { distance: 1 } : { createdAt: -1 },
      },

      {
        $facet: {
          result: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'total' }],
        },
      },
    );

    const [aggResult] = await Job.aggregate(pipeline);

    const result = aggResult?.result || [];
    const total = aggResult?.totalCount?.[0]?.total || 0;

    return {
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      result,
    };
  } else {
    const userId = new mongoose.Types.ObjectId(userData.profileId);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const searchTerm = (query.searchTerm as string) || '';
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    const maxDistance = Number(query.maxDistance)
      ? Number(query.maxDistance) * 1000
      : 5000;

    const type =
      (query.type as
        | 'assigned'
        | 'completed'
        | 'pending'
        | 'all'
        | 'cancelled'
        | 'open') || 'all';

    const filters: Record<string, any> = {
      customer: userId,
    };

    Object.keys(query).forEach((key) => {
      if (
        ![
          'searchTerm',
          'page',
          'limit',
          'lat',
          'lng',
          'maxDistance',
          'type',
        ].includes(key)
      ) {
        filters[key] = query[key];
      }
    });

    const searchMatch = searchTerm
      ? {
          $or: [
            { title: { $regex: searchTerm, $options: 'i' } },
            { address: { $regex: searchTerm, $options: 'i' } },
          ],
        }
      : {};

    if (type === 'assigned') {
      filters.bartender = { $ne: null };
      filters.status = { $ne: ENUM_JOB_STATUS.COMPLETED };
    } else if (type === 'completed') {
      filters.status = ENUM_JOB_STATUS.COMPLETED;
    } else if (type === 'open') {
      filters.status = ENUM_JOB_STATUS.PENDING;
    } else if (type === 'cancelled') {
      filters.status = ENUM_JOB_STATUS.CANCELLED;
    }

    const pipeline: any[] = [];

    const hasGeo = !isNaN(lat) && !isNaN(lng);

    if (hasGeo) {
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          key: 'location',
          distanceField: 'distance',
          maxDistance,
          query: { ...filters, ...searchMatch },
          spherical: true,
        },
      });
    } else {
      pipeline.push({
        $match: { ...filters, ...searchMatch },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'bartenders',
          localField: 'bartender',
          foreignField: '_id',
          as: 'bartender',
        },
      },
      {
        $unwind: {
          path: '$bartender',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          title: 1,
          address: 1,
          location: 1,
          startDateTime: 1,
          endDateTime: 1,
          hourlyRate: 1,
          contactNumber: 1,
          description: 1,
          status: 1,
          distance: 1,
          assignDate: 1,
          cancelledBy: 1,
          cancellationDate: 1,
          completedDate: 1,
          bartender: {
            name: 1,
            email: 1,
            profile_image: 1,
          },
        },
      },

      {
        $sort: hasGeo ? { distance: 1 } : { createdAt: -1 },
      },

      {
        $facet: {
          result: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'total' }],
        },
      },
    );

    const [aggResult] = await Job.aggregate(pipeline);

    const result = aggResult?.result || [];
    const total = aggResult?.totalCount?.[0]?.total || 0;

    return {
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      result,
    };
  }
};

const deleteJob = async (userId: string, jobId: string) => {
  const job = await Job.findOne({ _id: jobId, customer: userId });
  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, 'Job not found');
  }
  if (job.status === ENUM_JOB_STATUS.COMPLETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Completed job cannot be deleted',
    );
  }
  if (job.status === ENUM_JOB_STATUS.Assigned) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Assigned job cannot be deleted, please cancel the job instead',
    );
  }
  const result = await Job.findByIdAndDelete(jobId);
  return result;
};

const markAsComplete = async (customerId: string, jobId: string) => {
  const job = await Job.findOne({ _id: jobId, customer: customerId });
  if (!job) {
    throw new AppError(httpStatus.NOT_FOUND, 'Job not found for this customer');
  }
  if (job.status !== ENUM_JOB_STATUS.Assigned) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only assigned jobs can be marked as complete',
    );
  }
  const result = await Job.findByIdAndUpdate(
    jobId,
    { status: ENUM_JOB_STATUS.COMPLETED, completedDate: new Date() },
    { new: true, runValidators: true },
  );
  return result;
};

const cancelJob = async (userData: JwtPayload, jobId: string) => {
  if (userData.role === USER_ROLE.customer) {
    const job = await Job.findOne({ _id: jobId, customer: userData.profileId });
    if (!job) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Job not found for this customer',
      );
    }
    if (job.status === ENUM_JOB_STATUS.COMPLETED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Completed job cannot be cancelled',
      );
    }
    if (job.status === ENUM_JOB_STATUS.CANCELLED) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Job is already cancelled');
    }
    const result = await Job.findByIdAndUpdate(
      jobId,
      {
        status: ENUM_JOB_STATUS.CANCELLED,
        cancelledBy: ENUM_JOB_CANCELLED_BY.CUSTOMER,
        cancellationDate: new Date(),
      },
      { new: true, runValidators: true },
    );
    return result;
  } else if (userData.role === USER_ROLE.bartender) {
    const job = await Job.findOne({
      _id: jobId,
      bartender: userData.profileId,
    });
    if (!job) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Job not found for this bartender',
      );
    }
    if (job.status === ENUM_JOB_STATUS.COMPLETED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Completed job cannot be cancelled',
      );
    }
    if (job.status === ENUM_JOB_STATUS.CANCELLED) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Job is already cancelled');
    }
    const result = await Job.findByIdAndUpdate(
      jobId,
      {
        status: ENUM_JOB_STATUS.CANCELLED,
        cancelledBy: ENUM_JOB_CANCELLED_BY.BARTENDER,
        cancellationDate: new Date(),
      },
      { new: true, runValidators: true },
    );
    return result;
  } else {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid user role');
  }
};

const JobService = {
  createJob,
  updateJob,
  deleteJob,
  getAllJobsFromDB,
  getSingleJob,
  getMyJobs,
  markAsComplete,
  cancelJob,
};

export default JobService;
