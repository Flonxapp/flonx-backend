import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import BartenderService from './bartender.service';

const getAllBartender = catchAsync(async (req, res) => {
  const result = await BartenderService.getAllBartender(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bartender retrieved successfully',
    data: result,
  });
});
const getSingleBartender = catchAsync(async (req, res) => {
  const result = await BartenderService.getSingleBartender(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bartender retrieved successfully',
    data: result,
  });
});

const BartenderController = {
  getAllBartender,
  getSingleBartender,
};

export default BartenderController;
