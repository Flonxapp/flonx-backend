import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import RatingService from './rating.service';

const addRating = catchAsync(async (req, res) => {
  const result = await RatingService.addRating(
    req.user.profileId,
    req.body.bartender,
    req.body.job,
    req.body.rating,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Rating added successfully',
    data: result,
  });
});

const RatingController = {
  addRating,
};

export default RatingController;
