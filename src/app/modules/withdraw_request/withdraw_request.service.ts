/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import Stripe from 'stripe';
import QueryBuilder from '../../builder/QueryBuilder';
import { escapeRegex } from '../../builder/queryBuilder.utils';
import config from '../../config';
import AppError from '../../error/appError';
import { errorLogger, logger } from '../../shared/logger';
import stripe from '../../utilities/stripe';
import {
  ENUM_NOTIFICATION_TYPE,
  NOTIFICATION_ACTION,
  NOTIFICATION_ENTITY,
} from '../notification/notification.enum';
import NotificationService from '../notification/notification.services';
import {
  ENUM_TRANSACTION_REASON,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '../transaction/transaction.enum';
import Transaction from '../transaction/transaction.model';
import { USER_ROLE } from '../user/user.constant';
import { VenueOwner } from '../venue_owner/venue_owner.model';
import { toCents, toMoney } from '../wallet/wallet.service';
import {
  ENUM_WITHDRAW_STATUS,
  STALE_PROCESSING_MS,
} from './withdraw_request.enum';
import { WithdrawRequest } from './withdraw_request.model';

const OPEN_STATUSES = [
  ENUM_WITHDRAW_STATUS.PENDING,
  ENUM_WITHDRAW_STATUS.PROCESSING,
];
const MAX_PAGE_SIZE = 100;

const assertObjectId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid withdraw request id');
  }
};

const capLimit = (query: Record<string, unknown>) => {
  const limit = Number(query.limit) || 10;
  return { ...query, limit: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE) };
};

const notifyVenueOwner = (
  venueOwnerId: Types.ObjectId,
  requestId: Types.ObjectId,
  type: string,
  title: string,
  message: string,
  meta: Record<string, unknown> = {},
) => {
  NotificationService.sendNotification({
    receiver: venueOwnerId,
    title,
    message,
    type,
    entity: NOTIFICATION_ENTITY.WITHDRAW,
    entityId: requestId,
    action: NOTIFICATION_ACTION.VIEW,
    meta,
  }).catch((err: any) =>
    errorLogger.error('Withdraw notification failed', err),
  );
};

const getWallet = async (venueOwnerId: string) => {
  const venueOwner = await VenueOwner.findById(venueOwnerId).select(
    'currentBalance totalEarning totalWithdrawn isStripeAccountConnected',
  );
  if (!venueOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Venue owner not found');
  }

  const [open] = await WithdrawRequest.aggregate([
    {
      $match: {
        venueOwner: new Types.ObjectId(venueOwnerId),
        status: { $in: OPEN_STATUSES },
      },
    },
    { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  return {
    currency: 'usd',
    currentBalance: toMoney(venueOwner.currentBalance || 0),
    totalEarning: toMoney(venueOwner.totalEarning || 0),
    totalWithdrawn: toMoney(venueOwner.totalWithdrawn || 0),
    pendingWithdrawAmount: toMoney(open?.amount || 0),
    hasOpenRequest: (open?.count || 0) > 0,
    isStripeAccountConnected: !!venueOwner.isStripeAccountConnected,
    minWithdrawAmount: config.wallet.min_withdraw_amount,
    platformFeePercentage: config.wallet.platform_fee_percentage,
  };
};

const createWithdrawRequest = async (
  venueOwnerId: string,
  payload: { amount: number; note?: string },
) => {
  const amount = toMoney(payload.amount);
  const minAmount = config.wallet.min_withdraw_amount;
  if (amount < minAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum withdraw amount is $${minAmount}`,
    );
  }

  const session = await mongoose.startSession();
  try {
    let created: any;
    await session.withTransaction(async () => {
      const venueOwner = await VenueOwner.findOne({
        _id: venueOwnerId,
        isDeleted: false,
      }).session(session);
      if (!venueOwner) {
        throw new AppError(httpStatus.NOT_FOUND, 'Venue owner not found');
      }
      if (
        !venueOwner.isStripeAccountConnected ||
        !venueOwner.stripeConnectedAccountId
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Connect your Stripe account before requesting a withdrawal',
        );
      }

      const openRequest = await WithdrawRequest.exists({
        venueOwner: venueOwnerId,
        status: { $in: OPEN_STATUSES },
      }).session(session);
      if (openRequest) {
        throw new AppError(
          httpStatus.CONFLICT,
          'You already have a withdraw request under review. Please wait for it to be processed.',
        );
      }

      // Hold the amount until the admin decides. Returned on reject.
      const held = await VenueOwner.findOneAndUpdate(
        { _id: venueOwnerId, currentBalance: { $gte: amount } },
        { $inc: { currentBalance: -amount } },
        { new: true, session },
      );
      if (!held) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "You don't have enough balance for this withdrawal",
        );
      }

      [created] = await WithdrawRequest.create(
        [
          {
            venueOwner: venueOwnerId,
            amount,
            note: payload.note,
            stripeAccountId: venueOwner.stripeConnectedAccountId,
          },
        ],
        { session },
      );
    });

    logger.info('Withdraw request created', {
      withdrawRequestId: created?._id,
      venueOwnerId,
      amount,
    });
    return created;
  } finally {
    await session.endSession();
  }
};

const getMyWithdrawRequests = async (
  venueOwnerId: string,
  query: Record<string, unknown>,
) => {
  const builder = new QueryBuilder(
    WithdrawRequest.find({ venueOwner: venueOwnerId }).select(
      '-approveAttempts -processingStartedAt -lastError -processedBy',
    ),
    capLimit(query),
  )
    .filter()
    .sort()
    .paginate();

  const result = await builder.modelQuery;
  const meta = await builder.countTotal();
  return { meta, result };
};

const getSingleWithdrawRequest = async (
  id: string,
  user: { role: string; profileId: string },
) => {
  assertObjectId(id);
  const filter: Record<string, unknown> = { _id: id };
  const isAdmin = user.role === USER_ROLE.superAdmin;
  if (!isAdmin) filter.venueOwner = user.profileId;

  const query = WithdrawRequest.findOne(filter).populate(
    'venueOwner',
    'name email phone profile_image',
  );
  if (isAdmin) {
    query.populate('processedBy', 'name email');
  } else {
    query.select(
      '-approveAttempts -processingStartedAt -lastError -processedBy',
    );
  }

  const result = await query;
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw request not found');
  }
  return result;
};

const getAllWithdrawRequests = async (query: Record<string, unknown>) => {
  const { searchTerm, ...rest } = query;
  const baseFilter: Record<string, unknown> = {};

  if (typeof searchTerm === 'string' && searchTerm.trim()) {
    const regex = { $regex: escapeRegex(searchTerm.trim()), $options: 'i' };
    const owners = await VenueOwner.find({
      $or: [{ name: regex }, { email: regex }, { phone: regex }],
    })
      .select('_id')
      .limit(500);
    baseFilter.venueOwner = { $in: owners.map((o) => o._id) };
  }

  const builder = new QueryBuilder(
    WithdrawRequest.find(baseFilter).populate(
      'venueOwner',
      'name email phone profile_image isStripeAccountConnected currentBalance',
    ),
    capLimit(rest),
  )
    .filter()
    .sort()
    .paginate();

  const result = await builder.modelQuery;
  const meta = await builder.countTotal();

  const grouped = await WithdrawRequest.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        amount: { $sum: '$amount' },
      },
    },
  ]);
  const summary = Object.values(ENUM_WITHDRAW_STATUS).reduce(
    (acc, status) => {
      const row = grouped.find((g) => g._id === status);
      acc[status] = {
        count: row?.count || 0,
        amount: toMoney(row?.amount || 0),
      };
      return acc;
    },
    {} as Record<string, { count: number; amount: number }>,
  );

  return { meta: { ...meta, summary }, result };
};

// Called after the transfer is created and again from the transfer.created
// webhook. Only the first call changes anything.
const finalizeApprovedTransfer = async (
  withdrawRequestId: string,
  transfer: Stripe.Transfer,
) => {
  const session = await mongoose.startSession();
  let approved: any = null;
  try {
    await session.withTransaction(async () => {
      approved = await WithdrawRequest.findOneAndUpdate(
        { _id: withdrawRequestId, status: { $in: OPEN_STATUSES } },
        {
          $set: {
            status: ENUM_WITHDRAW_STATUS.APPROVED,
            stripeTransferId: transfer.id,
            stripeAccountId: transfer.destination as string,
            processedAt: new Date(),
          },
          $unset: { lastError: 1, processingStartedAt: 1 },
        },
        { new: true, session },
      );
      if (!approved) return;

      await Transaction.create(
        [
          {
            venueOwner: approved.venueOwner,
            type: TRANSACTION_TYPE.TRANSFER,
            status: TRANSACTION_STATUS.COMPLETED,
            amount: approved.amount,
            currency: approved.currency,
            stripeTransferId: transfer.id,
            stripeAccountId: transfer.destination as string,
            description: 'Withdrawal transferred to connected Stripe account',
            metadata: {
              reason: ENUM_TRANSACTION_REASON.WITHDRAWAL,
              withdrawRequestId: approved._id.toString(),
            },
          },
        ],
        { session },
      );

      await VenueOwner.updateOne(
        { _id: approved.venueOwner },
        { $inc: { totalWithdrawn: approved.amount } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (approved) {
    logger.info('Withdraw request approved', {
      withdrawRequestId,
      transferId: transfer.id,
    });
    notifyVenueOwner(
      approved.venueOwner,
      approved._id,
      ENUM_NOTIFICATION_TYPE.WITHDRAW_APPROVED,
      'Withdrawal approved',
      `Your withdrawal of $${approved.amount.toFixed(2)} was approved and sent to your Stripe account. It will reach your bank on your Stripe payout schedule.`,
      { amount: approved.amount, status: ENUM_WITHDRAW_STATUS.APPROVED },
    );
    return approved;
  }
  return WithdrawRequest.findById(withdrawRequestId);
};

const approveWithdrawRequest = async (id: string, adminProfileId: string) => {
  assertObjectId(id);
  const now = new Date();

  // Lock the request so it can't be paid twice. A new attempt gets a new
  // idempotency key; retrying a stuck one reuses the old key.
  let request = await WithdrawRequest.findOneAndUpdate(
    { _id: id, status: ENUM_WITHDRAW_STATUS.PENDING },
    {
      $set: {
        status: ENUM_WITHDRAW_STATUS.PROCESSING,
        processingStartedAt: now,
        processedBy: adminProfileId,
      },
      $inc: { approveAttempts: 1 },
    },
    { new: true },
  );
  if (!request) {
    request = await WithdrawRequest.findOneAndUpdate(
      {
        _id: id,
        status: ENUM_WITHDRAW_STATUS.PROCESSING,
        processingStartedAt: {
          $lte: new Date(now.getTime() - STALE_PROCESSING_MS),
        },
      },
      { $set: { processingStartedAt: now, processedBy: adminProfileId } },
      { new: true },
    );
  }
  if (!request) {
    const existing = await WithdrawRequest.findById(id).select('status');
    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Withdraw request not found');
    }
    if (existing.status === ENUM_WITHDRAW_STATUS.PROCESSING) {
      throw new AppError(
        httpStatus.CONFLICT,
        'This request is already being processed. Refresh in a moment.',
      );
    }
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `This request is already ${existing.status.toLowerCase()}`,
    );
  }

  let transfer: Stripe.Transfer | null = null;
  let transferAttempted = false;
  try {
    const venueOwner = await VenueOwner.findById(request.venueOwner).select(
      'name stripeConnectedAccountId isStripeAccountConnected',
    );
    const accountId = venueOwner?.stripeConnectedAccountId;
    if (!venueOwner || !accountId || !venueOwner.isStripeAccountConnected) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'The venue owner has not connected a Stripe account',
      );
    }

    const account = await stripe.accounts.retrieve(accountId);
    if (account.capabilities?.transfers !== 'active') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "The venue owner's Stripe account cannot receive transfers yet (onboarding incomplete or account restricted). Ask them to finish Stripe setup.",
      );
    }
    if (!account.payouts_enabled) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Payouts are disabled on the venue owner's Stripe account. Ask them to complete their bank details in Stripe.",
      );
    }
    // Old accounts were created with manual payouts. Switch them to automatic.
    if (account.settings?.payouts?.schedule?.interval === 'manual') {
      await stripe.accounts.update(accountId, {
        settings: {
          payouts: {
            schedule: {
              interval: config.wallet.connected_account_payout_interval,
            },
          },
        },
      });
    }

    transferAttempted = true;
    transfer = await stripe.transfers.create(
      {
        amount: toCents(request.amount),
        currency: request.currency || 'usd',
        destination: accountId,
        description: `Flonx withdrawal ${request._id.toString()}`,
        transfer_group: `WITHDRAW_${request._id.toString()}`,
        metadata: {
          purpose: 'WITHDRAWAL',
          withdrawRequestId: request._id.toString(),
          venueOwnerId: request.venueOwner.toString(),
        },
      },
      {
        idempotencyKey: `withdraw-request-${request._id.toString()}-attempt-${request.approveAttempts}`,
      },
    );

    return await finalizeApprovedTransfer(request._id.toString(), transfer);
  } catch (error: any) {
    if (transfer) {
      // Money already moved, so keep it PROCESSING. The webhook or a retry
      // will finish it.
      errorLogger.error('Withdraw transfer created but finalize failed', {
        withdrawRequestId: id,
        transferId: transfer.id,
        error: error?.message,
      });
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'The transfer was sent but saving the result failed. It will be completed automatically; refresh in a few minutes.',
      );
    }

    const reason =
      error instanceof AppError
        ? error.message
        : error?.raw?.message || error?.message || 'Stripe transfer failed';

    // We don't know if Stripe made the transfer. Keep it PROCESSING so a
    // retry with the same key gets the real result.
    const outcomeUnknown =
      transferAttempted &&
      (error?.type === 'StripeConnectionError' ||
        error?.type === 'StripeAPIError' ||
        !error?.statusCode ||
        error.statusCode >= 500);
    if (outcomeUnknown) {
      await WithdrawRequest.updateOne(
        { _id: request._id, status: ENUM_WITHDRAW_STATUS.PROCESSING },
        {
          $set: { lastError: `Stripe did not confirm the transfer: ${reason}` },
        },
      );
      errorLogger.error('Withdraw transfer outcome unknown', {
        withdrawRequestId: id,
        error: reason,
      });
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        'Stripe did not confirm the transfer. Do not reject this request; try approving again in 5 minutes and it will be completed without paying twice.',
      );
    }

    // Stripe declined or a check failed. Back to PENDING.
    await WithdrawRequest.updateOne(
      { _id: request._id, status: ENUM_WITHDRAW_STATUS.PROCESSING },
      {
        $set: { status: ENUM_WITHDRAW_STATUS.PENDING, lastError: reason },
        $unset: { processingStartedAt: 1, processedBy: 1 },
      },
    );
    errorLogger.error('Withdraw approval failed', {
      withdrawRequestId: id,
      error: reason,
    });

    if (error instanceof AppError) throw error;
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Stripe transfer failed: ${reason}`,
    );
  }
};

const rejectWithdrawRequest = async (
  id: string,
  adminProfileId: string,
  reason: string,
) => {
  assertObjectId(id);
  const session = await mongoose.startSession();
  let rejected: any = null;
  try {
    await session.withTransaction(async () => {
      rejected = await WithdrawRequest.findOneAndUpdate(
        { _id: id, status: ENUM_WITHDRAW_STATUS.PENDING },
        {
          $set: {
            status: ENUM_WITHDRAW_STATUS.REJECTED,
            rejectReason: reason,
            processedBy: adminProfileId,
            processedAt: new Date(),
          },
        },
        { new: true, session },
      );
      if (!rejected) return;

      // give the held amount back
      await VenueOwner.updateOne(
        { _id: rejected.venueOwner },
        { $inc: { currentBalance: rejected.amount } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (!rejected) {
    const existing = await WithdrawRequest.findById(id).select('status');
    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Withdraw request not found');
    }
    throw new AppError(
      httpStatus.BAD_REQUEST,
      existing.status === ENUM_WITHDRAW_STATUS.PROCESSING
        ? 'This request is being processed and can no longer be rejected'
        : `This request is already ${existing.status.toLowerCase()}`,
    );
  }

  logger.info('Withdraw request rejected', { withdrawRequestId: id });
  notifyVenueOwner(
    rejected.venueOwner,
    rejected._id,
    ENUM_NOTIFICATION_TYPE.WITHDRAW_REJECTED,
    'Withdrawal rejected',
    `Your withdrawal of $${rejected.amount.toFixed(2)} was rejected and the amount is back in your balance. Reason: ${reason}`,
    { amount: rejected.amount, status: ENUM_WITHDRAW_STATUS.REJECTED, reason },
  );
  return rejected;
};

// Transfer reversed in Stripe: return the money to the wallet.
// Partial reversals are only logged.
const handleTransferReversed = async (transfer: Stripe.Transfer) => {
  const withdrawRequestId = transfer.metadata?.withdrawRequestId;
  if (!withdrawRequestId) return;

  if (!transfer.reversed) {
    errorLogger.error(
      'Partial withdraw transfer reversal needs manual review',
      {
        withdrawRequestId,
        transferId: transfer.id,
        amountReversed: transfer.amount_reversed / 100,
      },
    );
    return;
  }

  const session = await mongoose.startSession();
  let reversed: any = null;
  try {
    await session.withTransaction(async () => {
      reversed = await WithdrawRequest.findOneAndUpdate(
        { _id: withdrawRequestId, status: ENUM_WITHDRAW_STATUS.APPROVED },
        {
          $set: {
            status: ENUM_WITHDRAW_STATUS.REVERSED,
            reversedAt: new Date(),
          },
        },
        { new: true, session },
      );
      if (!reversed) return;

      await Transaction.create(
        [
          {
            venueOwner: reversed.venueOwner,
            type: TRANSACTION_TYPE.REFUND,
            status: TRANSACTION_STATUS.COMPLETED,
            amount: reversed.amount,
            stripeTransferId: transfer.id,
            description: 'Withdrawal transfer reversed - returned to wallet',
            metadata: {
              reason: ENUM_TRANSACTION_REASON.WITHDRAWAL_REVERSED,
              withdrawRequestId,
            },
          },
        ],
        { session },
      );

      await VenueOwner.updateOne(
        { _id: reversed.venueOwner },
        {
          $inc: {
            currentBalance: reversed.amount,
            totalWithdrawn: -reversed.amount,
          },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (reversed) {
    notifyVenueOwner(
      reversed.venueOwner,
      reversed._id,
      ENUM_NOTIFICATION_TYPE.WITHDRAW_REVERSED,
      'Withdrawal reversed',
      `Your withdrawal of $${reversed.amount.toFixed(2)} was reversed and the amount is back in your balance.`,
      { amount: reversed.amount, status: ENUM_WITHDRAW_STATUS.REVERSED },
    );
  }
};

const WithdrawRequestService = {
  getWallet,
  createWithdrawRequest,
  getMyWithdrawRequests,
  getSingleWithdrawRequest,
  getAllWithdrawRequests,
  approveWithdrawRequest,
  rejectWithdrawRequest,
  finalizeApprovedTransfer,
  handleTransferReversed,
};

export default WithdrawRequestService;
