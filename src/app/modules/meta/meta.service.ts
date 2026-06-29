/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bartender } from '../bartender/bartender.model';
import Category from '../category/category.model';
import { Customer } from '../Customer/customer.model';
import { ENUM_ORDER_STATUS } from '../order/order.enum';
import { Order } from '../order/order.model';
import Product from '../product/product.model';
import { VenueOwner } from '../venue_owner/venue_owner.model';

const getMetaData = async () => {
  const [totalCustomers, totalBartenders, totalVenueOwners] = await Promise.all(
    [
      Customer.countDocuments(),
      Bartender.countDocuments(),
      VenueOwner.countDocuments(),
    ],
  );

  return {
    totalCustomers,
    totalBartenders,
    totalVenueOwners,
  };
};

// const getVenueActivities = async (
//   venueOwnerId: string,
//   query: Record<string, unknown>,
// ) => {
//   const { frame } = query; // e.g., 'Last 24 Hours', 'Last Week', etc.
//   const now = new Date();
//   let currentStart: Date | null = null;
//   let previousStart: Date | null = null;
//   let previousEnd: Date | null = null;

//   // Calculate current and previous periods
//   switch (frame) {
//     case 'Last 24 Hours':
//       currentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
//       previousStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
//       previousEnd = currentStart;
//       break;

//     case 'Last Week':
//       currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
//       previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
//       previousEnd = currentStart;
//       break;
//     case 'Last Fortnight':
//       currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
//       previousStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
//       previousEnd = currentStart;
//       break;
//     case 'Last Month':
//       currentStart = new Date();
//       currentStart.setMonth(now.getMonth() - 1);
//       previousStart = new Date();
//       previousStart.setMonth(now.getMonth() - 2);
//       previousEnd = currentStart;
//       break;

//     case 'Last Year':
//       currentStart = new Date();
//       currentStart.setFullYear(now.getFullYear() - 1);
//       previousStart = new Date();
//       previousStart.setFullYear(now.getFullYear() - 2);
//       previousEnd = currentStart;
//       break;

//     default:
//       currentStart = null; // All time
//       previousStart = null;
//       previousEnd = null;
//   }

//   // helper function to calculate % difference
//   const calcPercentage = (current: number, previous: number) => {
//     if (previous === 0) return current === 0 ? 0 : 100;
//     return ((current - previous) / previous) * 100;
//   };
//   // Build filters
//   const currentFilter: any = currentStart
//     ? { createdAt: { $gte: currentStart }, venueOwner: venueOwnerId }
//     : {};
//   const previousFilter: any =
//     previousStart && previousEnd
//       ? {
//           createdAt: { $gte: previousStart, $lt: previousEnd },
//           venueOwner: venueOwnerId,
//         }
//       : {};

//   // Run counts in parallel
//   const [currentCategory, prevCategory, currentProducts, prevProducts] =
//     await Promise.all([
//       Category.countDocuments(currentFilter),
//       previousStart ? Category.countDocuments(previousFilter) : 0,
//       Product.countDocuments(currentFilter),
//       previousStart ? Product.countDocuments(previousFilter) : 0,
//     ]);

//   return {
//     categories: {
//       count: currentCategory,
//       changePercent: calcPercentage(currentCategory, prevCategory),
//     },
//     products: {
//       count: currentProducts,
//       changePercent: calcPercentage(currentProducts, prevProducts),
//     },
//   };
// };

const getVenueActivities = async (
  venueOwnerId: string,
  query: Record<string, unknown>,
) => {
  const { frame } = query;

  const now = new Date();

  let currentStart: Date | null = null;
  let previousStart: Date | null = null;
  let previousEnd: Date | null = null;

  // =========================
  // Frame → Date range
  // =========================
  switch (frame) {
    case 'Last 24 Hours':
      currentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Week':
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Fortnight':
      currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Month':
      currentStart = new Date();
      currentStart.setMonth(now.getMonth() - 1);

      previousStart = new Date();
      previousStart.setMonth(now.getMonth() - 2);

      previousEnd = currentStart;
      break;

    case 'Last Year':
      currentStart = new Date();
      currentStart.setFullYear(now.getFullYear() - 1);

      previousStart = new Date();
      previousStart.setFullYear(now.getFullYear() - 2);

      previousEnd = currentStart;
      break;

    default:
      currentStart = null;
      previousStart = null;
      previousEnd = null;
  }

  // =========================
  // Trending threshold helper
  // =========================
  const getFrameDays = (frame?: string) => {
    switch (frame) {
      case 'Last 24 Hours':
        return 1;
      case 'Last Week':
        return 7;
      case 'Last Fortnight':
        return 14;
      case 'Last Month':
        return 30;
      case 'Last Year':
        return 365;
      default:
        return null;
    }
  };

  const days = getFrameDays(frame as string);
  const trendingThreshold = days ? days * 50 : 50;

  // =========================
  // Filters
  // =========================
  const currentFilter: any = {
    venueOwner: venueOwnerId,
  };

  const previousFilter: any = {
    venueOwner: venueOwnerId,
  };

  if (currentStart) {
    currentFilter.createdAt = {
      $gte: currentStart,
      $lte: now,
    };
  }

  if (previousStart && previousEnd) {
    previousFilter.createdAt = {
      $gte: previousStart,
      $lt: previousEnd,
    };
  }

  // =========================
  // Trending products (ONLY COUNT)
  // =========================
  const trendingProducts = await Order.aggregate([
    {
      $match: currentFilter,
    },
    {
      $unwind: '$items',
    },
    {
      $group: {
        _id: '$items.product',
        totalOrdered: { $sum: '$items.quantity' },
      },
    },
    {
      $match: {
        totalOrdered: { $gte: trendingThreshold },
      },
    },
    {
      $count: 'trendingCount',
    },
  ]);

  const trendingProductsCount =
    trendingProducts.length > 0 ? trendingProducts[0].trendingCount : 0;

  // =========================
  // Percentage helper
  // =========================
  const calcPercentage = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  };

  // =========================
  // Total orders + earnings
  // =========================
  const [
    currentTotalOrders,
    previousTotalOrders,
    currentTotalEarnings,
    previousTotalEarnings,
  ] = await Promise.all([
    Order.countDocuments(currentFilter),

    previousStart ? Order.countDocuments(previousFilter) : 0,

    Order.aggregate([
      { $match: currentFilter },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalPrice' },
        },
      },
    ]),

    previousStart
      ? Order.aggregate([
          { $match: previousFilter },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalPrice' },
            },
          },
        ])
      : [],
  ]);

  const currentEarnings = currentTotalEarnings[0]?.total || 0;
  const previousEarnings = previousTotalEarnings[0]?.total || 0;

  // =========================
  // Response
  // =========================
  return {
    totalOrders: {
      count: currentTotalOrders,
      changePercent: calcPercentage(currentTotalOrders, previousTotalOrders),
    },

    totalEarnings: {
      amount: currentEarnings,
      changePercent: calcPercentage(currentEarnings, previousEarnings),
    },

    trendingProductsCount,
  };
};

const getActivities = async (query: Record<string, unknown>) => {
  try {
    const { frame } = query; // e.g., 'Last 24 Hours', 'Last Week', etc.
    const now = new Date();

    let currentStart: Date | null = null;
    let previousStart: Date | null = null;
    let previousEnd: Date | null = null;

    // Calculate current and previous periods
    switch (frame) {
      case 'Last 24 Hours':
        currentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
      case 'Last Week':
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
      case 'Last Fortnight':
        currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
      case 'Last Month':
        currentStart = new Date();
        currentStart.setMonth(now.getMonth() - 1);
        previousStart = new Date();
        previousStart.setMonth(now.getMonth() - 2);
        previousEnd = currentStart;
        break;
      case 'Last Year':
        currentStart = new Date();
        currentStart.setFullYear(now.getFullYear() - 1);
        previousStart = new Date();
        previousStart.setFullYear(now.getFullYear() - 2);
        previousEnd = currentStart;
        break;
      default:
        currentStart = null; // All time
        previousStart = null;
        previousEnd = null;
    }

    // Helper function to calculate % difference
    const calcPercentage = (current: number, previous: number) => {
      if (previous === 0) return current === 0 ? 0 : 100;
      return ((current - previous) / previous) * 100;
    };

    // Build filters
    const currentFilter: any = currentStart
      ? { createdAt: { $gte: currentStart } }
      : {};
    const previousFilter: any =
      previousStart && previousEnd
        ? { createdAt: { $gte: previousStart, $lt: previousEnd } }
        : {};

    // Run counts in parallel
    const [
      currentUsers,
      prevUsers,
      currentBartenders,
      prevBartenders,
      currentVenueOwners,
      prevVenueOwners,
    ] = await Promise.all([
      Customer.countDocuments(currentFilter),
      previousStart ? Customer.countDocuments(previousFilter) : 0,
      Bartender.countDocuments(currentFilter),
      previousStart ? Bartender.countDocuments(previousFilter) : 0,
      VenueOwner.countDocuments(currentFilter),
      previousStart ? VenueOwner.countDocuments(previousFilter) : 0,
    ]);

    return {
      users: {
        count: currentUsers,
        changePercent: calcPercentage(currentUsers, prevUsers),
      },
      bartenders: {
        count: currentBartenders,
        changePercent: calcPercentage(currentBartenders, prevBartenders),
      },
      venueOwners: {
        count: currentVenueOwners,
        changePercent: calcPercentage(currentVenueOwners, prevVenueOwners),
      },
    };
  } catch (err) {
    console.error(err);
  }
};

const getVenueOwnerMetaData = async (venueOwnerId: string) => {
  const [totalCategories, totalProducts] = await Promise.all([
    Category.countDocuments({ venueOwner: venueOwnerId }),
    Product.countDocuments({ venueOwner: venueOwnerId }),
  ]);

  const trendingThreshold = 50;
  const trendingProducts = await Order.aggregate([
    {
      $match: { venueOwner: new mongoose.Types.ObjectId(venueOwnerId) },
    },
    {
      $unwind: '$items',
    },
    {
      $group: {
        _id: '$items.product',
        totalOrdered: { $sum: '$items.quantity' },
      },
    },
    {
      $match: {
        totalOrdered: { $gte: trendingThreshold },
      },
    },
    {
      $count: 'trendingCount',
    },
  ]);

  const trendingProductsCount =
    trendingProducts.length > 0 ? trendingProducts[0].trendingCount : 0;

  return {
    totalCategories,
    totalProducts,
    trendingItems: trendingProductsCount,
  };
};

import mongoose from 'mongoose';

const getVenueOwnerEarning = async (
  venueOwnerId: string,
  query: Record<string, unknown>,
) => {
  const { frame } = query;

  const now = new Date();

  let currentStart: Date | null = null;
  let previousStart: Date | null = null;
  let previousEnd: Date | null = null;

  switch (frame) {
    case 'Last 24 Hours':
      currentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Week':
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Fortnight':
      currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Month':
      currentStart = new Date();
      currentStart.setMonth(now.getMonth() - 1);

      previousStart = new Date();
      previousStart.setMonth(now.getMonth() - 2);

      previousEnd = currentStart;
      break;

    case 'Last Year':
      currentStart = new Date();
      currentStart.setFullYear(now.getFullYear() - 1);

      previousStart = new Date();
      previousStart.setFullYear(now.getFullYear() - 2);

      previousEnd = currentStart;
      break;

    default:
      currentStart = null;
      previousStart = null;
      previousEnd = null;
  }

  // -------------------------------
  // Helpers
  // -------------------------------
  const calcPercentage = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
  };

  // -------------------------------
  // Filters
  // -------------------------------
  const baseMatch = {
    venueOwner: new mongoose.Types.ObjectId(venueOwnerId),
    status: {
      $nin: [ENUM_ORDER_STATUS.CANCELLED, ENUM_ORDER_STATUS.PENDING],
    },
  };

  const currentFilter: any = currentStart
    ? {
        ...baseMatch,
        createdAt: { $gte: currentStart },
      }
    : baseMatch;

  const previousFilter: any =
    previousStart && previousEnd
      ? {
          ...baseMatch,
          createdAt: { $gte: previousStart, $lt: previousEnd },
        }
      : null;

  // -------------------------------
  // Aggregation function
  // -------------------------------
  const getOrderEarning = async (filter: any) => {
    return Order.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          totalEarning: { $sum: '$totalPrice' },
          totalTip: { $sum: { $ifNull: ['$tipAmount', 0] } },
          totalOrders: { $sum: 1 },
        },
      },
    ]);
  };

  // -------------------------------
  // Run in parallel
  // -------------------------------
  const [currentOrderStats, prevOrderStats] = await Promise.all([
    getOrderEarning(currentFilter),
    previousFilter ? getOrderEarning(previousFilter) : [],
  ]);

  // -------------------------------
  // Safe extraction
  // -------------------------------
  const current = currentOrderStats[0] || {
    totalEarning: 0,
    totalTip: 0,
    totalOrders: 0,
  };

  const previous = prevOrderStats[0] || {
    totalEarning: 0,
    totalTip: 0,
    totalOrders: 0,
  };

  // -------------------------------
  // Final response
  // -------------------------------
  return {
    earning: {
      total: current.totalEarning,
      changePercent: calcPercentage(
        current.totalEarning,
        previous.totalEarning,
      ),
    },

    tips: {
      total: current.totalTip,
      changePercent: calcPercentage(current.totalTip, previous.totalTip),
    },

    orders: {
      count: current.totalOrders,
      changePercent: calcPercentage(current.totalOrders, previous.totalOrders),
    },
  };
};
const getAdminEarnings = async (query: Record<string, unknown>) => {
  const { frame } = query;

  const now = new Date();

  let currentStart: Date | null = null;
  let previousStart: Date | null = null;
  let previousEnd: Date | null = null;

  switch (frame) {
    case 'Last 24 Hours':
      currentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Week':
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Fortnight':
      currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;

    case 'Last Month':
      currentStart = new Date();
      currentStart.setMonth(now.getMonth() - 1);

      previousStart = new Date();
      previousStart.setMonth(now.getMonth() - 2);

      previousEnd = currentStart;
      break;

    case 'Last Year':
      currentStart = new Date();
      currentStart.setFullYear(now.getFullYear() - 1);

      previousStart = new Date();
      previousStart.setFullYear(now.getFullYear() - 2);

      previousEnd = currentStart;
      break;

    default:
      currentStart = null;
      previousStart = null;
      previousEnd = null;
  }

  // -------------------------------
  // Helpers
  // -------------------------------
  const calcPercentage = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
  };

  // -------------------------------
  // Filters
  // -------------------------------
  const baseMatch = {
    status: {
      $nin: [ENUM_ORDER_STATUS.CANCELLED, ENUM_ORDER_STATUS.PENDING],
    },
  };

  const currentFilter: any = currentStart
    ? {
        ...baseMatch,
        createdAt: { $gte: currentStart },
      }
    : baseMatch;

  const previousFilter: any =
    previousStart && previousEnd
      ? {
          ...baseMatch,
          createdAt: { $gte: previousStart, $lt: previousEnd },
        }
      : null;

  // Aggregation function (FIXED)

  const getOrderEarning = async (filter: any) => {
    return Order.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          totalEarning: {
            $sum: {
              $multiply: ['$totalPrice', 0.2], // ✅ only 20% for admin
            },
          },
          totalOrders: {
            $sum: 1,
          },
        },
      },
    ]);
  };

  // Run in parallel
  const [currentOrderStats, prevOrderStats] = await Promise.all([
    getOrderEarning(currentFilter),
    previousFilter ? getOrderEarning(previousFilter) : [],
  ]);

  const current = currentOrderStats[0] || {
    totalEarning: 0,
    totalTip: 0,
    totalOrders: 0,
  };

  const previous = prevOrderStats[0] || {
    totalEarning: 0,
    totalTip: 0,
    totalOrders: 0,
  };

  // Final response
  return {
    earning: {
      total: current.totalEarning,
      changePercent: calcPercentage(
        current.totalEarning,
        previous.totalEarning,
      ),
    },
    orders: {
      count: current.totalOrders,
      changePercent: calcPercentage(current.totalOrders, previous.totalOrders),
    },
  };
};

const MetaService = {
  getMetaData,
  getActivities,
  getVenueOwnerMetaData,
  getVenueActivities,
  getVenueOwnerEarning,
  getAdminEarnings,
};

export default MetaService;
