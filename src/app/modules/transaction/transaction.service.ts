/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import moment from 'moment';
import { PipelineStage, Types } from 'mongoose';
import { z } from 'zod';
import AppError from '../../error/appError';
import { USER_ROLE } from '../user/user.constant';
import { toMoney } from '../wallet/wallet.service';
import {
  deriveTransactionDirection,
  ENUM_TRANSACTION_REASON,
  TRANSACTION_DIRECTION,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from './transaction.enum';
import Transaction from './transaction.model';

const MAX_LIMIT = 100;

const objectId = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), 'Invalid id');

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(20),
  sort: z.enum(['createdAt', '-createdAt', 'amount', '-amount']).optional(),
  type: z.nativeEnum(TRANSACTION_TYPE).optional(),
  status: z.nativeEnum(TRANSACTION_STATUS).optional(),
  direction: z.nativeEnum(TRANSACTION_DIRECTION).optional(),
  reason: z
    .enum(Object.values(ENUM_TRANSACTION_REASON) as [string, ...string[]])
    .optional(),
  order: objectId.optional(),
  from: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  // old preset filters
  filterType: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  date: z.string().optional(),
  week: z.coerce.number().int().min(1).max(53).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  // admin only
  venueOwner: objectId.optional(),
  customer: objectId.optional(),
});

type TListQuery = z.infer<typeof listQuerySchema>;

const parseQuery = (query: Record<string, unknown>): TListQuery => {
  const parsed = listQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    );
  }
  return parsed.data;
};

const dateRange = (q: TListQuery) => {
  if (q.from || q.to) {
    const range: Record<string, Date> = {};
    if (q.from) range.$gte = moment(q.from).startOf('day').toDate();
    if (q.to) range.$lte = moment(q.to).endOf('day').toDate();
    return range;
  }

  let start: moment.Moment | null = null;
  let unit: moment.unitOfTime.StartOf = 'day';
  if (q.filterType === 'daily' && q.date) {
    start = moment(q.date);
    unit = 'day';
  } else if (q.filterType === 'weekly' && q.week && q.year) {
    start = moment().year(q.year).week(q.week);
    unit = 'week';
  } else if (q.filterType === 'monthly' && q.month && q.year) {
    start = moment()
      .year(q.year)
      .month(q.month - 1);
    unit = 'month';
  } else if (q.filterType === 'yearly' && q.year) {
    start = moment().year(q.year);
    unit = 'year';
  }
  if (!start || !start.isValid()) return null;
  return {
    $gte: start.clone().startOf(unit).toDate(),
    $lte: start.clone().endOf(unit).toDate(),
  };
};

const buildFilter = (q: TListQuery, base: Record<string, unknown>) => {
  const filter: Record<string, any> = { ...base };
  if (q.type) filter.type = q.type;
  if (q.status) filter.status = q.status;
  if (q.direction) filter.direction = q.direction;
  if (q.reason) filter['metadata.reason'] = q.reason;
  if (q.order) filter.order = new Types.ObjectId(q.order);
  const range = dateRange(q);
  if (range) filter.createdAt = range;
  return filter;
};

// older records have no direction saved
const withDirection = (doc: any) => ({
  ...doc,
  direction:
    doc.direction || deriveTransactionDirection(doc.type, doc.metadata?.reason),
});

const sortSpec = (sort?: string): Record<string, 1 | -1> => {
  if (!sort) return { createdAt: -1, _id: -1 };
  const desc = sort.startsWith('-');
  return { [sort.replace('-', '')]: desc ? -1 : 1, _id: desc ? -1 : 1 };
};

const paginate = async (
  filter: Record<string, any>,
  q: TListQuery,
  opts: { select: string; populate: { path: string; select: string }[] },
) => {
  let query = Transaction.find(filter)
    .select(opts.select)
    .sort(sortSpec(q.sort))
    .skip((q.page - 1) * q.limit)
    .limit(q.limit)
    .lean();
  for (const p of opts.populate) query = query.populate(p);

  const [rows, total] = await Promise.all([
    query,
    Transaction.countDocuments(filter),
  ]);
  return {
    result: rows.map(withDirection),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPage: Math.ceil(total / q.limit),
    },
  };
};

const directionTotals = async (filter: Record<string, any>) => {
  const rows = await Transaction.aggregate([
    { $match: { ...filter, status: TRANSACTION_STATUS.COMPLETED } },
    { $group: { _id: '$direction', amount: { $sum: '$amount' } } },
  ] as PipelineStage[]);
  const get = (d: string) =>
    toMoney(rows.find((r) => r._id === d)?.amount || 0);
  const totalCredit = get(TRANSACTION_DIRECTION.CREDIT);
  const totalDebit = get(TRANSACTION_DIRECTION.DEBIT);
  return { totalCredit, totalDebit, net: toMoney(totalCredit - totalDebit) };
};

const getMyTransaction = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const q = parseQuery(query);
  const owner = new Types.ObjectId(user.profileId);

  let base: Record<string, unknown>;
  let select: string;
  if (user.role === USER_ROLE.customer) {
    base = { customer: owner };
    select =
      '-__v -stripeEventId -stripeAccountId -stripeTransferId -stripePayoutId -venueOwner';
  } else if (user.role === USER_ROLE.venueOwner) {
    base = { venueOwner: owner };
    select = '-__v -stripeEventId -customer';
  } else {
    throw new AppError(httpStatus.FORBIDDEN, 'Not allowed');
  }

  const filter = buildFilter(q, base);
  const [page, summary] = await Promise.all([
    paginate(filter, q, {
      select,
      populate: [{ path: 'order', select: 'orderCode totalPrice status' }],
    }),
    directionTotals(filter),
  ]);
  return { meta: { ...page.meta, summary }, result: page.result };
};

const getAllTransaction = async (query: Record<string, unknown>) => {
  const q = parseQuery(query);
  const base: Record<string, unknown> = {};
  if (q.venueOwner) base.venueOwner = new Types.ObjectId(q.venueOwner);
  if (q.customer) base.customer = new Types.ObjectId(q.customer);
  const filter = buildFilter(q, base);

  // totals use the date and owner filters only
  const totalsFilter: Record<string, any> = { ...base };
  if (filter.createdAt) totalsFilter.createdAt = filter.createdAt;

  const [page, grouped] = await Promise.all([
    paginate(filter, q, {
      select: '-__v',
      populate: [
        { path: 'venueOwner', select: 'name email' },
        { path: 'customer', select: 'name email' },
        { path: 'order', select: 'orderCode totalPrice status' },
      ],
    }),
    Transaction.aggregate([
      {
        $match: { ...totalsFilter, status: TRANSACTION_STATUS.COMPLETED },
      },
      {
        $group: {
          _id: { type: '$type', reason: '$metadata.reason' },
          amount: { $sum: '$amount' },
        },
      },
    ] as PipelineStage[]),
  ]);

  const sum = (type: string, reasons?: string[]) =>
    toMoney(
      grouped
        .filter(
          (g) =>
            g._id.type === type && (!reasons || reasons.includes(g._id.reason)),
        )
        .reduce((acc, g) => acc + g.amount, 0),
    );

  const summary = {
    customerPayments: sum(TRANSACTION_TYPE.PAYMENT),
    platformRevenue: sum(TRANSACTION_TYPE.PLATFORM_FEE),
    refundedToCustomers: sum(TRANSACTION_TYPE.REFUND, [
      ENUM_TRANSACTION_REASON.ORDER_REFUND,
    ]),
    creditedToVenueOwners: sum(TRANSACTION_TYPE.EARNING),
    transferredToVenueOwners: sum(TRANSACTION_TYPE.TRANSFER, [
      ENUM_TRANSACTION_REASON.WITHDRAWAL,
    ]),
  };

  return { meta: { ...page.meta, summary }, result: page.result };
};

const getSingleTransaction = async (user: JwtPayload, id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid transaction id');
  }
  const filter: Record<string, unknown> = { _id: id };
  if (user.role === USER_ROLE.customer) filter.customer = user.profileId;
  else if (user.role === USER_ROLE.venueOwner)
    filter.venueOwner = user.profileId;
  else if (user.role !== USER_ROLE.superAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'Not allowed');
  }

  const doc = await Transaction.findOne(filter)
    .select('-__v')
    .populate({ path: 'order', select: 'orderCode totalPrice status' })
    .populate({ path: 'venueOwner', select: 'name email' })
    .populate({ path: 'customer', select: 'name email' })
    .lean();
  if (!doc) {
    throw new AppError(httpStatus.NOT_FOUND, 'Transaction not found');
  }
  return withDirection(doc);
};

const TransactionServices = {
  getMyTransaction,
  getAllTransaction,
  getSingleTransaction,
};
export default TransactionServices;
