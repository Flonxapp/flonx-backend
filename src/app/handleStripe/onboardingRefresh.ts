import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import AppError from '../error/appError';
import { VenueOwner } from '../modules/venue_owner/venue_owner.model';
import {
  createOnboardingLink,
  isValidOnboardingSignature,
} from '../utilities/onboardingLink';

// Stripe sends the browser here when an onboarding link has expired.
const onboardingRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { accountId, sig } = req.query;
    if (typeof accountId !== 'string' || typeof sig !== 'string') {
      return res.status(httpStatus.BAD_REQUEST).send('Invalid link');
    }
    if (!isValidOnboardingSignature(accountId, sig)) {
      return res.status(httpStatus.FORBIDDEN).send('Invalid link');
    }
    const owner = await VenueOwner.findOne({
      stripeConnectedAccountId: accountId,
    }).select('_id');
    if (!owner) {
      return res.status(httpStatus.NOT_FOUND).send('Account not found');
    }
    return res.redirect(await createOnboardingLink(accountId));
  } catch {
    return next(
      new AppError(httpStatus.BAD_REQUEST, 'Update onboarding link failed'),
    );
  }
};

export default onboardingRefresh;
