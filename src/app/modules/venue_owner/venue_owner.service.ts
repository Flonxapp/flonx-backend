import httpStatus from 'http-status';
import mongoose from 'mongoose';
import AppError from '../../error/appError';
import { VenueOwner } from './venue_owner.model';

/* eslint-disable @typescript-eslint/no-explicit-any */
const getAllVenueOwners = async (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const searchTerm = query.searchTerm || '';
  const status = query.status;

  const filters: any = {};
  Object.keys(query).forEach((key) => {
    if (!['searchTerm', 'page', 'limit', 'status'].includes(key)) {
      filters[key] = query[key];
    }
  });

  // Status filter for blocked/unblocked users
  const statusFilter: any = {};
  if (status === 'blocked') statusFilter['user.isBlocked'] = true;
  else if (status === 'unblocked') statusFilter['user.isBlocked'] = false;

  // Search stage
  const searchMatchStage = searchTerm
    ? {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { phone: { $regex: searchTerm, $options: 'i' } },
          { 'user.name': { $regex: searchTerm, $options: 'i' } },
          { 'user.email': { $regex: searchTerm, $options: 'i' } },
        ],
      }
    : {};

  const pipeline: any[] = [
    { $match: filters },

    // Lookup user info
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },

    // Apply search
    { $match: searchMatchStage },

    // Apply status filter
    ...(Object.keys(statusFilter).length ? [{ $match: statusFilter }] : []),

    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        profile_image: 1,
        isVenueInfoProvided: 1,
        createdAt: 1,
        updatedAt: 1,
        stripeConnectedAccountId: 1,
        isStripeAccountConnected: 1,
        user: {
          _id: '$user._id',
          isBlocked: '$user.isBlocked',
          isActive: '$user.isActive',
        },
      },
    },

    { $sort: { createdAt: -1 } },

    {
      $facet: {
        result: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'total' }],
      },
    },
  ];

  const aggResult = await VenueOwner.aggregate(pipeline);

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

const getSingleVenueOwner = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid venue owner ID');
  }

  const result = await VenueOwner.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        profile_image: 1,
        isVenueInfoProvided: 1,
        isStripeAccountConnected: 1,
        stripeConnectedAccountId: 1,
        createdAt: 1,
        updatedAt: 1,
        user: {
          _id: 1,
          isBlocked: 1,
          isActive: 1,
        },
      },
    },
  ]);

  if (!result[0]) {
    throw new AppError(httpStatus.NOT_FOUND, 'Venue owner not found');
  }

  return result[0];
};

const VenueOwnerService = {
  getAllVenueOwners,
  getSingleVenueOwner,
};

export default VenueOwnerService;
