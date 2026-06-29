import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import VenueOwnerService from './venue_owner.service';

const getAllVenueOwners = catchAsync(async (req, res) => {
  const result = await VenueOwnerService.getAllVenueOwners(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Venue owners retrieved successfully',
    data: result,
  });
});

const getSingleVenueOwner = catchAsync(async (req, res) => {
  const result = await VenueOwnerService.getSingleVenueOwner(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Venue owner retrieved successfully',
    data: result,
  });
});

const VenueOwnerController = {
  getAllVenueOwners,
  getSingleVenueOwner,
};

export default VenueOwnerController;
