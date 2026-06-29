import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import BookmarkService from './bookmark.service';

const bookmarkAddDelete = catchAsync(async (req, res) => {
  const result = await BookmarkService.bookmarkAddDelete(
    req.user.profileId,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result
      ? 'Product added to wishlist '
      : 'Product deleted from wishlist',
    data: result,
  });
});
// get my bookmark--------------------
const getMyBookmark = catchAsync(async (req, res) => {
  const result = await BookmarkService.getMyBookmarkFromDB(
    req?.user?.profileId,
    req.query,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Wishlist retrieved successfully',
    data: result,
  });
});

const BookmarkController = {
  bookmarkAddDelete,
  getMyBookmark,
};

export default BookmarkController;
