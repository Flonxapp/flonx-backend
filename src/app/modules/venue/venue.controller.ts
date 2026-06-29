/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { getCloudFrontUrl } from '../../aws/multer-s3-uploader';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import VenueService from './venue.service';

const addVenueInfo = catchAsync(async (req, res) => {
  const file: any = req.files?.venue_logo;
  if (req.files?.venue_logo) {
    req.body.logo = getCloudFrontUrl(file[0].key);
  }
  const result: any = await VenueService.addVenueInfo(
    req.user.profileId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Venue information added successfully`,
    data: result,
  });
});
const updateVenue = catchAsync(async (req, res) => {
  const file: any = req.files?.venue_logo;
  if (req.files?.venue_logo) {
    req.body.logo = getCloudFrontUrl(file[0].key);
  }
  const result = await VenueService.updateVenue(
    req.user.profileId,
    req.params.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Venue information updated successfully`,
    data: result,
  });
});
const getAllVenue = catchAsync(async (req, res) => {
  const result = await VenueService.getAllVenueFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Venue retrieved successfully`,
    data: result,
  });
});
const getSingleVenue = catchAsync(async (req, res) => {
  const result = await VenueService.getSingleVenue(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Venue retrieved successfully`,
    data: result,
  });
});
const getMyVenue = catchAsync(async (req, res) => {
  const result = await VenueService.getMyVenue(req.user.profileId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Venue retrieved successfully`,
    data: result,
  });
});

const VenueController = {
  addVenueInfo,
  updateVenue,
  getAllVenue,
  getSingleVenue,
  getMyVenue,
};

export default VenueController;
