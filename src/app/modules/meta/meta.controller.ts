import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import MetaService from './meta.service';

const getMetaData = catchAsync(async (req, res) => {
  const result = await MetaService.getMetaData();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Meta data retrieved successfully',
    data: result,
  });
});
const getActivities = catchAsync(async (req, res) => {
  const result = await MetaService.getActivities(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Activities data retrieved successfully',
    data: result,
  });
});
const getVenueActivities = catchAsync(async (req, res) => {
  const result = await MetaService.getVenueActivities(
    req.user.profileId,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Venue activities data retrieved successfully',
    data: result,
  });
});
const getVenueOwnerMetaData = catchAsync(async (req, res) => {
  const result = await MetaService.getVenueOwnerMetaData(req.user.profileId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Venue owner meta data retrieved successfully',
    data: result,
  });
});
const getVenueOwnerEarning = catchAsync(async (req, res) => {
  const result = await MetaService.getVenueOwnerEarning(
    req.user.profileId,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Venue owner earning data retrieved successfully',
    data: result,
  });
});
const getAdminEarning = catchAsync(async (req, res) => {
  const result = await MetaService.getAdminEarnings(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin earning data retrieved successfully',
    data: result,
  });
});

const MetaController = {
  getMetaData,
  getActivities,
  getVenueOwnerMetaData,
  getVenueActivities,
  getVenueOwnerEarning,
  getAdminEarning,
};

export default MetaController;
