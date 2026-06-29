/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { deleteFileFromS3 } from '../../aws/deleteFromS2';
import AppError from '../../error/appError';
import { generateVenueQRCode } from '../../helper/generateVenueQrCode';
import { VenueOwner } from '../venue_owner/venue_owner.model';
import { AddVenueInfoDTO } from './venue.dto';
import { Venue } from './venue.model';

import mongoose from 'mongoose';

const addVenueInfo = async (venueOwnerId: string, payload: AddVenueInfoDTO) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const venueExits = await Venue.findOne({ venueOwner: venueOwnerId }).session(
    session,
  );
  if (venueExits) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Venue already exists for this venue owner',
    );
  }

  try {
    const venue = await Venue.create(
      [{ ...payload, venueOwner: venueOwnerId }],
      { session },
    );

    const venueDoc: any = venue[0];

    const qrCodeUrl = await generateVenueQRCode(venueDoc._id.toString());

    venueDoc.qrCodeUrl = qrCodeUrl;
    await venueDoc.save({ session });

    await VenueOwner.findByIdAndUpdate(
      venueOwnerId,
      { isVenueInfoProvided: true },
      { new: true, runValidators: true, session },
    );

    await session.commitTransaction();
    session.endSession();

    return venueDoc;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
const updateVenue = async (
  venueOwnerId: string,
  id: string,
  payload: AddVenueInfoDTO,
) => {
  const venue = await Venue.findById(id);
  if (!venue) {
    throw new AppError(httpStatus.NOT_FOUND, 'Venue not found');
  }

  if (venue.venueOwner.toString() != venueOwnerId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This is not your venue , you are not able to update it',
    );
  }
  const result = await Venue.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  if (payload.logo && venue.logo) {
    deleteFileFromS3(venue.logo);
  }
  return result;
};

const getAllVenueFromDB = async (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const searchTerm = query.searchTerm || '';
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const maxDistance = Number(query.maxDistance) * 1000 || 5000; // in meters

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

  // Prepare search term filter
  const searchMatchStage = searchTerm
    ? { $or: [{ name: { $regex: searchTerm, $options: 'i' } }] }
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

  // Lookup venue owner
  pipeline.push(
    {
      $lookup: {
        from: 'venueowners',
        localField: 'venueOwner',
        foreignField: '_id',
        as: 'venueOwner',
      },
    },
    { $unwind: '$venueOwner' },
    {
      $project: {
        _id: 1,
        name: 1,
        phone: 1,
        email: 1,
        location: 1,
        address: 1,
        logo: 1,
        distance: 1, // distance in meters
        isOpen: 1,
        venueOwner: {
          name: 1,
          email: 1,
          phone: 1,
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

  const aggResult = await Venue.aggregate(pipeline);
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

const getSingleVenue = async (id: string) => {
  const result = await Venue.findById(id).populate({
    path: 'venueOwner',
    select: 'name email phone profile_image',
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Venue not found');
  }
  return result;
};

const getMyVenue = async (venueOwnerId: string) => {
  const result = await Venue.findOne({ venueOwner: venueOwnerId });
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Venue not found for this venue owner',
    );
  }
  return result;
};

export { getAllVenueFromDB };

const VenueService = {
  addVenueInfo,
  updateVenue,
  getAllVenueFromDB,
  getSingleVenue,
  getMyVenue,
};

export default VenueService;
