/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { deleteFileFromS3 } from '../../aws/deleteFromS2';
import AppError from '../../error/appError';
import Category from '../category/category.model';
import { UpdateProductDTO } from './product.dto';
import { IProduct } from './product.interface';
import Product from './product.model';

const createProduct = async (venueOwnerId: string, payload: IProduct) => {
  const category = await Category.findOne({
    venueOwner: venueOwnerId,
    _id: payload.category,
  });
  if (!category) {
    deleteFileFromS3(payload.image);
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }
  const result = await Product.create({ ...payload, venueOwner: venueOwnerId });
  return result;
};

const deleteSingleProduct = async (profileId: string, id: string) => {
  const product = await Product.findOneAndUpdate(
    { venueOwner: profileId, _id: id },
    { isDeleted: true },
    { new: true, runValidators: true },
  );

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  if (product.image) {
    deleteFileFromS3(product.image);
  }

  return product;
};

// change product status -------------

const changeProductStatus = async (
  profileId: string,
  id: string,
  status: string,
) => {
  const product = await Product.findOne({ venueOwner: profileId, _id: id });
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }
  const result = await Product.findByIdAndUpdate(
    id,
    { status: status },
    { new: true, runValidators: true },
  );
  return result;
};

const getVenueProducts = async (
  venueId: string,
  query: Record<string, unknown>,
) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const searchTerm = query.searchTerm || '';
  const filters: any = {};
  if (query.category) {
    filters.category = new mongoose.Types.ObjectId(query.category as string);
  }
  Object.keys(query).forEach((key) => {
    if (!['searchTerm', 'page', 'limit', 'category'].includes(key)) {
      filters[key] = query[key];
    }
  });

  const matchStage: any = {};

  const searchMatchStage: any = searchTerm
    ? {
        $or: [{ name: { $regex: searchTerm, $options: 'i' } }],
      }
    : {};

  const pipeline: any[] = [
    {
      $match: {
        ...matchStage,
        ...filters,
        ...searchMatchStage,
        venue: new mongoose.Types.ObjectId(venueId),
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'venues',
        localField: 'venue',
        foreignField: '_id',
        as: 'venue',
      },
    },
    {
      $unwind: '$venue',
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category',
      },
    },
    {
      $unwind: '$category',
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        category: 1,
        price: 1,
        image: 1,
        tags: 1,
        isAvailable: true,
        stock: true,
        slogan: 1,
        createdAt: 1,
        updatedAt: 1,
        venue: {
          name: 1,
          email: 1,
          logo: 1,
          _id: 1,
        },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $facet: {
        result: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'total' }],
      },
    },
  ];

  const aggResult = await Product.aggregate(pipeline);
  const result = aggResult[0]?.result || [];
  const total = aggResult[0]?.totalCount[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
    result,
  };
};

const getSingleProduct = async (id: string) => {
  const result = await Product.findById(id)
    .populate({
      path: 'venue',
      select: 'name logo email phone',
    })
    .populate({ path: 'category', select: 'name' });

  return result;
};

const updateProduct = async (
  profileId: string,
  id: string,
  payload: UpdateProductDTO,
) => {
  const product = await Product.findOne({ venueOwner: profileId, _id: id });
  if (!product) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Product not found or this is not your product',
    );
  }

  if (payload.category) {
    const category = await Category.findById(payload.category);
    if (!category) {
      throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
    }
  }

  const result = await Product.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  if (payload.image && product.image) {
    deleteFileFromS3(product.image);
  }

  return result;
};

const ProductService = {
  createProduct,
  deleteSingleProduct,
  changeProductStatus,
  getVenueProducts,
  getSingleProduct,
  updateProduct,
};

export default ProductService;
