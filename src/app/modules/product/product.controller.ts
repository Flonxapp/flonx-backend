/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { getCloudFrontUrl } from '../../aws/multer-s3-uploader';
import getVenueIdForVenueOwner from '../../helper/getVenueForVenueOwner';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import ProductService from './product.service';

const createProduct = catchAsync(async (req, res) => {
  const file: any = req.files?.product_image;
  if (req.files?.product_image) {
    req.body.image = getCloudFrontUrl(file[0].key);
  }
  const venueId = await getVenueIdForVenueOwner(req.user.profileId);
  req.body.venue = venueId;
  const result = await ProductService.createProduct(
    req.user.profileId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Product created successfully',
    data: result,
  });
});

// delete single publich product
const deleteSingleProduct = catchAsync(async (req, res) => {
  const result = await ProductService.deleteSingleProduct(
    req.user.profileId,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product deleted successfully',
    data: result,
  });
});

// change product status

const changeProductStatus = catchAsync(async (req, res) => {
  const result = await ProductService.changeProductStatus(
    req.user.profileId,
    req.params.id,
    req.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Product is now`,
    data: result,
  });
});
const getVenueProducts = catchAsync(async (req, res) => {
  const result = await ProductService.getVenueProducts(
    req.params.id,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Product retrieved successfully`,
    data: result,
  });
});
const getSingleProduct = catchAsync(async (req, res) => {
  const result = await ProductService.getSingleProduct(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Product retrieved successfully`,
    data: result,
  });
});
const updateProduct = catchAsync(async (req, res) => {
  const file: any = req.files?.product_image;
  if (req.files?.product_image) {
    req.body.image = getCloudFrontUrl(file[0].key);
  }

  const result = await ProductService.updateProduct(
    req.user.profileId,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Product updated successfully`,
    data: result,
  });
});

const ProductController = {
  createProduct,
  deleteSingleProduct,
  changeProductStatus,
  getVenueProducts,
  getSingleProduct,
  updateProduct,
};

export default ProductController;
