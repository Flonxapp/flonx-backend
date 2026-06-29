import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import { getVenueOwnerWallet, withdrawFromVenueOwner } from './payment.service';

const makeWithDraw = catchAsync(async (req, res) => {
  const venueOwnerId = req.user?.profileId;
  const result = await withdrawFromVenueOwner(venueOwnerId, req.body.amount);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Withdrawal successful',
    data: result,
  });
});

const getWallet = catchAsync(async (req, res) => {
  const venueOwnerId = req.user?.profileId;
  const result = await getVenueOwnerWallet(venueOwnerId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Venue owner wallet fetched',
    data: result,
  });
});

const PaymentController = {
  makeWithDraw,
  getWallet,
};

export default PaymentController;
