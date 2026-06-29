/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import AppError from '../../error/appError';
import { ICategory } from './category.interface';
import Category from './category.model';

// create category into db
const createCategoryIntoDB = async (
  venueOwnerId: string,
  payload: ICategory,
) => {
  const result = await Category.create({
    ...payload,
    venueOwner: venueOwnerId,
  });
  return result;
};

const updateCategoryIntoDB = async (
  venueOwnerId: string,
  id: string,
  payload: Partial<ICategory>,
) => {
  const result = await Category.findOneAndUpdate(
    { venueOwner: venueOwnerId, _id: id },
    payload,
    {
      new: true,
      runValidators: true,
    },
  );
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }
  return result;
};

const getAllCategories = async (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const searchTerm = query.searchTerm || '';

  const filters: any = {};
  Object.keys(query).forEach((key) => {
    if (!['searchTerm', 'page', 'limit'].includes(key)) {
      filters[key] = query[key];
    }
  });

  const searchMatchStage = searchTerm
    ? {
        $or: [{ name: { $regex: searchTerm, $options: 'i' } }],
      }
    : {};

  const aggResult = await Category.aggregate([
    {
      $match: {
        ...filters,
        ...searchMatchStage,
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'products',
        let: { categoryId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$category', '$$categoryId'] },
            },
          },
          {
            $count: 'total',
          },
        ],
        as: 'productStats',
      },
    },
    {
      $addFields: {
        totalProduct: {
          $ifNull: [{ $arrayElemAt: ['$productStats.total', 0] }, 0],
        },
      },
    },
    {
      $project: {
        productStats: 0, // remove unwanted array
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
  ]);

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

const venueCategories = async (
  venueId: string,
  query: Record<string, unknown>,
) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const searchTerm = query.searchTerm || '';

  // dynamic filters
  const filters: any = {};
  Object.keys(query).forEach((key) => {
    if (!['searchTerm', 'page', 'limit'].includes(key)) {
      filters[key] = query[key];
    }
  });

  // search condition
  const searchMatchStage = searchTerm
    ? {
        $or: [{ name: { $regex: searchTerm, $options: 'i' } }],
      }
    : {};

  const aggResult = await Category.aggregate([
    {
      $match: {
        isDeleted: false,
        venue: new mongoose.Types.ObjectId(venueId),
        ...filters,
        ...searchMatchStage,
      },
    },
    {
      $lookup: {
        from: 'products',
        let: { categoryId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$category', '$$categoryId'] },
                  { $eq: ['$isDeleted', false] }, // important
                ],
              },
            },
          },
          {
            $count: 'total',
          },
        ],
        as: 'productStats',
      },
    },
    {
      $addFields: {
        totalProduct: {
          $ifNull: [{ $arrayElemAt: ['$productStats.total', 0] }, 0],
        },
      },
    },
    {
      $project: {
        productStats: 0,
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
  ]);

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
const getSingleCategory = async (id: string) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return category;
};

// delete category
const deleteCategoryFromDB = async (
  venueOwnerId: string,
  categoryId: string,
) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  } else if (category.venueOwner.toString() != venueOwnerId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This is not your venue category so you are not able to delete it',
    );
  }
  const result = await Category.findByIdAndUpdate(
    categoryId,
    { isDeleted: true },
    { new: true, runValidators: true },
  );
  return result;
};

const categoryService = {
  createCategoryIntoDB,
  updateCategoryIntoDB,
  getAllCategories,
  getSingleCategory,
  deleteCategoryFromDB,
  venueCategories,
};

export default categoryService;
