import mongoose from 'mongoose';
import AppError from '../../error/appError';
import stripe from '../../utilities/stripe';
import { Customer } from './customer.model';

/* eslint-disable @typescript-eslint/no-explicit-any */
const getAllCustomers = async (query: Record<string, unknown>) => {
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

  // Search stage
  const searchMatchStage = searchTerm
    ? {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { phone: { $regex: searchTerm, $options: 'i' } },
          { 'user.name': { $regex: searchTerm, $options: 'i' } },
          { 'user.email': { $regex: searchTerm, $options: 'i' } },
        ],
      }
    : {};

  const pipeline: any[] = [
    { $match: filters },

    // Lookup user info
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },

    // Apply search after lookup
    { $match: searchMatchStage },

    // Optional: You could add ratings aggregation here if you have Customer ratings

    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        profile_image: 1,
        isGuest: 1,
        createdAt: 1,
        updatedAt: 1,
        user: {
          _id: '$user._id',
          isBlocked: '$user.isBlocked',
          isActive: '$user.isActive',
        },
      },
    },
    { $sort: { createdAt: -1 } },

    // Pagination & total count
    {
      $facet: {
        result: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'total' }],
      },
    },
  ];

  const aggResult = await Customer.aggregate(pipeline);

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

const getSingleCustomer = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid customer ID');
  }

  const result = await Customer.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        profile_image: 1,
        isGuest: 1,
        createdAt: 1,
        updatedAt: 1,
        user: {
          _id: 1,
          isBlocked: 1,
          isActive: 1,
        },
      },
    },
  ]);

  if (!result[0]) {
    throw new Error('Customer not found');
  }

  return result[0];
};

const getPaymentMethods = async (customerId: string) => {
  const customer = await Customer.findById(customerId);

  if (!customer) {
    throw new AppError(404, 'Customer not found');
  }

  if (!customer.stripeCustomerId) {
    return [];
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customer.stripeCustomerId,
    type: 'card',
  });

  console.log(
    'Retrieved payment methods from Stripe:',
    paymentMethods.data.length,
    paymentMethods.data,
  );

  // REMOVE DUPLICATES
  const uniqueMap = new Map();

  paymentMethods.data.forEach((pm) => {
    const fingerprint = pm.card?.fingerprint;

    if (!fingerprint) return;

    if (!uniqueMap.has(fingerprint)) {
      uniqueMap.set(fingerprint, {
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        type: pm.type,
      });
    }
  });

  return Array.from(uniqueMap.values());
};
const CustomerService = {
  getAllCustomers,
  getSingleCustomer,
  getPaymentMethods,
};

export default CustomerService;
