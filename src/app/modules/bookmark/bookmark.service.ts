import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import Product from '../product/product.model';
import {
  default as Bookmark,
  default as ProductBookmark,
} from './bookmark.mode';

const bookmarkAddDelete = async (profileId: string, productId: string) => {
  // check if article exists
  const product = await Product.exists({ _id: productId });
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
  }
  const bookmark = await Bookmark.exists({
    reviewer: profileId,
    product: productId,
  });
  if (bookmark) {
    await ProductBookmark.findOneAndDelete({
      reviewer: profileId,
      product: productId,
    });
    return null;
  } else {
    const result = await ProductBookmark.create({
      reviewer: profileId,
      product: productId,
    });
    return result;
  }
};

// get bookmark from db
const getMyBookmarkFromDB = async (
  profileId: string,
  query: Record<string, unknown>,
) => {
  const bookmarkQuery = new QueryBuilder(
    Bookmark.find({ reviewer: profileId }).populate({
      path: 'product',
      select: 'name images price',
    }),
    query,
  )
    .search([''])
    .fields()
    .filter()
    .paginate()
    .sort();
  const result = await bookmarkQuery.modelQuery;
  const meta = await bookmarkQuery.countTotal();
  return {
    meta,
    result,
  };
};

const BookmarkService = {
  bookmarkAddDelete,
  getMyBookmarkFromDB,
};

export default BookmarkService;
