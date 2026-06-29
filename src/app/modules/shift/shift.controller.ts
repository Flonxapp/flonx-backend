import httpStatus from 'http-status';
import getVenueIdForVenueOwner from '../../helper/getVenueForVenueOwner';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import ShiftRequestService from './shift.service';

const sendShiftRequestToBartender = catchAsync(async (req, res) => {
  const venueOwnerId = req.user.profileId;
  const venueId = await getVenueIdForVenueOwner(venueOwnerId);
  req.body.venueOwner = venueOwnerId;
  req.body.venue = venueId;
  const result = await ShiftRequestService.sendShiftToBartender(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shift request sent successfully',
    data: result,
  });
});
const getMyShiftRequest = catchAsync(async (req, res) => {
  const result = await ShiftRequestService.getMyShifts(req.user, req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shift requests retrieved successfully',
    data: result,
  });
});
const getCurrentShift = catchAsync(async (req, res) => {
  const result = await ShiftRequestService.getCurrentShift(req.user.profileId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Current shift retrieved successfully',
    data: result,
  });
});

const getSingleShift = catchAsync(async (req, res) => {
  const result = await ShiftRequestService.getSingleShiftWithStats(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shift retrieved successfully',
    data: result,
  });
});

const acceptRejectShiftRequest = catchAsync(async (req, res) => {
  const result = await ShiftRequestService.acceptRejectShiftRequest(
    req.user.profileId,
    req.params.id,
    req.body.isAccept,
  );

  const message = req.body.isAccept
    ? 'Shift request accepted'
    : 'Shift request rejected';
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message,
    data: result,
  });
});
const declineShift = catchAsync(async (req, res) => {
  const result = await ShiftRequestService.declineShift(
    req.params.id,
    req.user.profileId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shift request declined',
    data: result,
  });
});

const ShiftRequestController = {
  sendShiftRequestToBartender,
  getMyShiftRequest,
  acceptRejectShiftRequest,
  declineShift,
  getCurrentShift,
  getSingleShift,
};

export default ShiftRequestController;
