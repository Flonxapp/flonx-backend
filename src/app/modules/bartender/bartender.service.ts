import mongoose from 'mongoose';
import { ENUM_JOB_STATUS } from '../job/job.enum';
import { Bartender } from './bartender.model';

/* eslint-disable @typescript-eslint/no-explicit-any */
const getAllBartender = async (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const status = query.status;
  const searchTerm = query.searchTerm || '';
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const maxDistance = Number(query.maxDistance) * 1000 || 5000; // in meters

  const filters: any = {};
  Object.keys(query).forEach((key) => {
    if (
      ![
        'searchTerm',
        'page',
        'limit',
        'lat',
        'lng',
        'maxDistance',
        'status',
      ].includes(key)
    ) {
      filters[key] = query[key];
    }
  });
  const statusFilter: any = {};
  if (status === 'blocked') statusFilter['user.isBlocked'] = true;
  else if (status === 'unblocked') statusFilter['user.isBlocked'] = false;
  // Prepare search term filter
  const searchMatchStage = searchTerm
    ? {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
        ],
      }
    : {};

  const pipeline: any[] = [];

  if (!isNaN(lat) && !isNaN(lng)) {
    pipeline.push({
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        key: 'location', // the 2dsphere field
        distanceField: 'distance', // numeric distance in meters
        maxDistance: maxDistance, // in meters
        query: { ...filters, ...searchMatchStage },
        spherical: true,
      },
    });
  } else {
    pipeline.push({
      $match: { ...filters, ...searchMatchStage },
    });
  }

  // lookup user
  pipeline.push(
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
  );

  if (Object.keys(statusFilter).length > 0) {
    pipeline.push({
      $match: statusFilter,
    });
  }

  // Lookup rating
  pipeline.push(
    {
      $lookup: {
        from: 'ratings',
        localField: '_id',
        foreignField: 'bartender',
        as: 'ratings',
      },
    },
    {
      $addFields: {
        totalRatings: { $size: '$ratings' },
        averageRating: {
          $cond: [
            { $gt: [{ $size: '$ratings' }, 0] },
            { $avg: '$ratings.rating' },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        phone: 1,
        email: 1,
        location: 1,
        address: 1,
        distance: 1,
        totalRatings: 1,
        averageRating: 1,
        createdAt: 1,
        updatedAt: 1,
        experience: 1,
        bio: 1,
        skills: 1,
        user: {
          _id: 1,
          isBlocked: 1,
          isActive: 1,
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

  const aggResult = await Bartender.aggregate(pipeline);
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

const getSingleBartender = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid bartender ID');
  }

  const result = await Bartender.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },

    {
      $lookup: {
        from: 'ratings',
        localField: '_id',
        foreignField: 'bartender',
        as: 'ratings',
      },
    },
    {
      $addFields: {
        totalRatings: { $size: '$ratings' },
        averageRating: { $ifNull: [{ $avg: '$ratings.rating' }, 0] },
      },
    },

    {
      $lookup: {
        from: 'jobs',
        localField: '_id',
        foreignField: 'bartender',
        as: 'jobs',
      },
    },
    {
      $addFields: {
        totalCompletedJob: {
          $size: {
            $filter: {
              input: '$jobs',
              as: 'job',
              cond: {
                $eq: ['$$job.status', ENUM_JOB_STATUS.COMPLETED],
              },
            },
          },
        },
      },
    },

    {
      $project: {
        _id: 1,
        name: 1,
        phone: 1,
        email: 1,
        location: 1,
        address: 1,
        totalRatings: 1,
        averageRating: 1,
        profile_image: 1,
        createdAt: 1,
        updatedAt: 1,
        experience: 1,
        bio: 1,
        skills: 1,
        totalCompletedJob: 1,
        user: {
          _id: 1,
          isBlocked: 1,
          isActive: 1,
        },
      },
    },
  ]);

  if (!result[0]) {
    throw new Error('Bartender not found');
  }

  return result[0];
};
const BartenderService = {
  getAllBartender,
  getSingleBartender,
};

export default BartenderService;
