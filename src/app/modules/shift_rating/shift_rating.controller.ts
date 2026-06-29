import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import ShiftRatingService from './shift_rating.service';

const addRating = catchAsync(async (req, res) => {
  const result = await ShiftRatingService.addRating(
    req.user.profileId,
    req.body.bartender,
    req.body.shift,
    req.body.rating,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Rating added successfully',
    data: result,
  });
});

const ShiftRatingController = {
  addRating,
};

export default ShiftRatingController;
