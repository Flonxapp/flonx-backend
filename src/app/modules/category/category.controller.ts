/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import AppError from '../../error/appError';
import getVenueIdForVenueOwner from '../../helper/getVenueForVenueOwner';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import categoryService from './category.services';

const createCategory = catchAsync(async (req, res) => {
  console.log(req.user);
  const venueId = await getVenueIdForVenueOwner(req.user.profileId);
  if (!venueId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Before doing that you must add venue info',
    );
  }
  req.body.venue = venueId;
  const result = await categoryService.createCategoryIntoDB(
    req.user.profileId,
    req?.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category created successfully',
    data: result,
  });
});

const getAllCategories = catchAsync(async (req, res) => {
  const result = await categoryService.getAllCategories(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category retrieved successfully',
    data: result,
  });
});
const getVenueCategories = catchAsync(async (req, res) => {
  const result = await categoryService.venueCategories(
    req.params.id,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category retrieved successfully',
    data: result,
  });
});
const getSingleCategory = catchAsync(async (req, res) => {
  const result = await categoryService.getSingleCategory(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category retrieved successfully',
    data: result,
  });
});

const updateCategory = catchAsync(async (req, res) => {
  const result = await categoryService.updateCategoryIntoDB(
    req.user.profileId,
    req?.params?.id,
    req?.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category updated successfully',
    data: result,
  });
});

// delete category
const deleteCategory = catchAsync(async (req, res) => {
  const result = await categoryService.deleteCategoryFromDB(
    req.user.profileId,
    req?.params?.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category deleted successfully',
    data: result,
  });
});

const categoryController = {
  createCategory,
  updateCategory,
  getSingleCategory,
  deleteCategory,
  getAllCategories,
  getVenueCategories,
};
export default categoryController;
