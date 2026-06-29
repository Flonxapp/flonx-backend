/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import cron from 'node-cron';
import AppError from '../../error/appError';
import { ENUM_ORDER_STATUS } from '../order/order.enum';
import { USER_ROLE } from '../user/user.constant';
import { ENUM_SHIFT_STATUS } from './shift.enum';
import { IShift } from './shift.interface';
import { Shift } from './shift.model';

const sendShiftToBartender = async (payload: IShift) => {
  const { bartender, venueOwner, startDateTime, endDateTime } = payload;

  /**
   * Check overlapping shift for bartender
   *
   * Overlap condition:
   * existing.start < new.end
   * AND
   * existing.end > new.start
   */
  const existingBartenderShift = await Shift.findOne({
    bartender,
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime },
    status: {
      $in: [ENUM_SHIFT_STATUS.Active, ENUM_SHIFT_STATUS.Upcoming],
    },
  });

  if (existingBartenderShift) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Bartender already has a shift/request in this time window',
    );
  }

  const existingVenueOwnerRequest = await Shift.findOne({
    venueOwner,
    bartender,
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime },
    status: {
      $in: [ENUM_SHIFT_STATUS.Active, ENUM_SHIFT_STATUS.Upcoming],
    },
  });

  if (existingVenueOwnerRequest) {
    throw new Error(
      'You already booked a shift  to this bartender for this time window',
    );
  }

  const result = await Shift.create(payload);

  return result;
};

// const getMyShifts = async (
//   userData: JwtPayload,
//   query: Record<string, unknown>,
// ) => {
//   const page = Number(query?.page) || 1;
//   const limit = Number(query?.limit) || 10;
//   const skip = (page - 1) * limit;
//   const filters: any = {};

//   if (userData.role == USER_ROLE.bartender) {
//     filters.bartender = new mongoose.Types.ObjectId(userData.profileId);
//   } else {
//     filters.venueOwner = new mongoose.Types.ObjectId(userData.profileId);
//   }
//   Object.keys(query).forEach((key) => {
//     if (
//       !['searchTerm', 'page', 'limit', 'lat', 'lng', 'maxDistance'].includes(
//         key,
//       )
//     ) {
//       filters[key] = query[key];
//     }
//   });
//   const aggResult = await Shift.aggregate([
//     {
//       $match: {
//         ...filters,
//       },
//     },
//     {
//       $lookup: {
//         from: 'bartenders',
//         localField: 'bartender',
//         foreignField: '_id',
//         as: 'bartender',
//       },
//     },
//     {
//       $unwind: '$bartender',
//     },
//     {
//       $lookup: {
//         from: 'venues',
//         localField: 'venue',
//         foreignField: '_id',
//         as: 'venue',
//       },
//     },
//     {
//       $unwind: '$venue',
//     },
//     {
//       $facet: {
//         result: [{ $skip: skip }, { $limit: limit }],
//         totalCount: [{ $count: 'total' }],
//       },
//     },
//   ]);

//   const result = aggResult[0]?.result || [];
//   const total = aggResult[0]?.totalCount[0]?.total || 0;
//   const totalPages = Math.ceil(total / limit);
//   return {
//     meta: {
//       page,
//       limit,
//       total,
//       totalPages,
//     },
//     result,
//   };
// };
const getMyShifts = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  const page = Number(query?.page) || 1;
  const limit = Number(query?.limit) || 10;
  const skip = (page - 1) * limit;

  const filters: any = {};

  if (userData.role === USER_ROLE.bartender) {
    filters.bartender = new mongoose.Types.ObjectId(userData.profileId);
  } else {
    filters.venueOwner = new mongoose.Types.ObjectId(userData.profileId);
  }

  // normal filters (except searchTerm)
  Object.keys(query).forEach((key) => {
    if (
      !['searchTerm', 'page', 'limit', 'lat', 'lng', 'maxDistance'].includes(
        key,
      )
    ) {
      filters[key] = query[key];
    }
  });

  const searchTerm = query?.searchTerm as string;

  const pipeline: any[] = [
    {
      $match: filters,
    },

    {
      $lookup: {
        from: 'bartenders',
        localField: 'bartender',
        foreignField: '_id',
        as: 'bartender',
      },
    },
    {
      $unwind: '$bartender',
    },

    {
      $lookup: {
        from: 'venues',
        localField: 'venue',
        foreignField: '_id',
        as: 'venue',
      },
    },
    {
      $unwind: '$venue',
    },
  ];

  if (searchTerm) {
    pipeline.push({
      $match: {
        $or: [
          {
            'bartender.name': {
              $regex: searchTerm,
              $options: 'i',
            },
          },
          {
            'venue.name': {
              $regex: searchTerm,
              $options: 'i',
            },
          },
        ],
      },
    });
  }

  pipeline.push({
    $facet: {
      result: [{ $skip: skip }, { $limit: limit }],
      totalCount: [{ $count: 'total' }],
    },
  });

  const aggResult = await Shift.aggregate(pipeline);

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
const acceptRejectShiftRequest = async (
  bartenderId: string,
  id: string,
  isAccept: boolean,
) => {
  console.log('Shift Request ID:', id);
  const shiftRequestIIIII = await Shift.findById(id)
    .populate('venue')
    .populate('bartender');
  console.log('Shift Request Details:', shiftRequestIIIII);
  const shiftRequest = await Shift.findOne({
    bartender: bartenderId,
    _id: id,
    status: ENUM_SHIFT_STATUS.Requested,
  });

  if (!shiftRequest) {
    throw new AppError(httpStatus.NOT_FOUND, 'Shift request not found');
  }

  // Time already started check
  const now = new Date();
  if (now >= new Date(shiftRequest.startDateTime) && isAccept) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot accept this shift after it has started',
    );
  }

  // Overlapping shift check (ONLY when accepting)
  if (isAccept) {
    const overlappingShift = await Shift.findOne({
      venue: shiftRequest.venue,
      _id: { $ne: shiftRequest._id },
      status: ENUM_SHIFT_STATUS.Upcoming,
      $or: [
        {
          startDateTime: { $lt: shiftRequest.endDateTime },
          endDateTime: { $gt: shiftRequest.startDateTime },
        },
      ],
    });

    if (overlappingShift) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Another bartender is already assigned to this venue during this time',
      );
    }
  }

  const status = isAccept
    ? ENUM_SHIFT_STATUS.Upcoming
    : ENUM_SHIFT_STATUS.Rejected;

  const result = await Shift.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true },
  );

  return result;
};

const getCurrentShift = async (bartenderId: string) => {
  const now = new Date();
  const currentShift = await Shift.findOne({
    bartender: bartenderId,
    status: ENUM_SHIFT_STATUS.Active,
    startDateTime: { $lte: now },
    endDateTime: { $gte: now },
  }).populate('venue');
  let upcomingShift = null;
  if (!currentShift) {
    upcomingShift = await Shift.findOne({
      bartender: bartenderId,
      status: ENUM_SHIFT_STATUS.Upcoming,
      startDateTime: { $gt: now },
    })
      .sort({ startDateTime: 1 })
      .populate('venue');
  }
  return { currentShift, upcomingShift };
};

const getSingleShiftWithStats = async (shiftId: string) => {
  const result = await Shift.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(shiftId),
      },
    },

    // 🔹 Populate Venue
    {
      $lookup: {
        from: 'venues',
        localField: 'venue',
        foreignField: '_id',
        as: 'venue',
      },
    },
    {
      $unwind: {
        path: '$venue',
        preserveNullAndEmptyArrays: true,
      },
    },

    // 🔹 Populate Bartender
    {
      $lookup: {
        from: 'bartenders', // ⚠️ check your collection name
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

    // 🔹 Orders aggregation
    {
      $lookup: {
        from: 'orders',
        let: { shiftId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$shift', '$$shiftId'] },
                  { $ne: ['$status', ENUM_ORDER_STATUS.CANCELLED] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalOrderCount: { $sum: 1 },
              totalOrderAmount: { $sum: '$totalPrice' },
              totalTipAmount: {
                $sum: { $ifNull: ['$tipAmount', 0] },
              },
              totalTipCount: {
                $sum: {
                  $cond: [{ $gt: ['$tipAmount', 0] }, 1, 0],
                },
              },
            },
          },
        ],
        as: 'orderStats',
      },
    },

    // 🔹 Ratings aggregation
    {
      $lookup: {
        from: 'shiftratings',
        let: {
          shiftId: '$_id',
          bartenderId: '$bartender',
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$shift', '$$shiftId'] },
                  { $eq: ['$bartender', '$$bartenderId'] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalRatingCount: { $sum: 1 },
              avgRating: { $avg: '$rating' },
            },
          },
        ],
        as: 'ratingStats',
      },
    },

    // 🔹 Flatten
    {
      $addFields: {
        orderStats: { $arrayElemAt: ['$orderStats', 0] },
        ratingStats: { $arrayElemAt: ['$ratingStats', 0] },
      },
    },

    // 🔹 Final projection
    {
      $project: {
        venueOwner: 1,
        venue: 1,
        bartender: 1,
        startDateTime: 1,
        endDateTime: 1,
        status: 1,
        shiftRate: 1,
        createdAt: 1,
        updatedAt: 1,

        totalOrderCount: { $ifNull: ['$orderStats.totalOrderCount', 0] },
        totalOrderAmount: { $ifNull: ['$orderStats.totalOrderAmount', 0] },
        totalTipAmount: { $ifNull: ['$orderStats.totalTipAmount', 0] },
        totalTipCount: { $ifNull: ['$orderStats.totalTipCount', 0] },

        totalRatingCount: { $ifNull: ['$ratingStats.totalRatingCount', 0] },
        avgRating: { $ifNull: ['$ratingStats.avgRating', 0] },
      },
    },
  ]);

  return result[0];
};

const declineShift = async (id: string, venueOwnerId: string) => {
  const shift = await Shift.findOne({ _id: id, venueOwner: venueOwnerId });
  if (!shift) {
    throw new AppError(httpStatus.NOT_FOUND, 'Shift not found');
  }
  if (shift.status !== ENUM_SHIFT_STATUS.Requested) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only requested shifts can be declined',
    );
  }
  const result = await Shift.findByIdAndDelete(id);
  return result;
};
// crone jobs -------------------------------------
cron.schedule('* * * * *', async () => {
  console.log('⏱ Running Shift Cron Job...');

  try {
    const now = new Date();

    const activeResult = await Shift.updateMany(
      {
        status: ENUM_SHIFT_STATUS.Upcoming,
        startDateTime: { $lte: now },
      },
      {
        $set: { status: ENUM_SHIFT_STATUS.Active },
      },
    );

    const completedResult = await Shift.updateMany(
      {
        status: ENUM_SHIFT_STATUS.Active,
        endDateTime: { $lte: now },
      },
      {
        $set: { status: ENUM_SHIFT_STATUS.Completed },
      },
    );

    if (activeResult.modifiedCount > 0) {
      console.log(`${activeResult.modifiedCount} shift(s) → ACTIVE`);
    }

    if (completedResult.modifiedCount > 0) {
      console.log(`${completedResult.modifiedCount} shift(s) → COMPLETED`);
    }
  } catch (error) {
    console.error('Shift Cron Error:', error);
  }
});

const ShiftService = {
  sendShiftToBartender,
  getMyShifts,
  acceptRejectShiftRequest,
  getCurrentShift,
  getSingleShiftWithStats,
  declineShift,
};

export default ShiftService;
