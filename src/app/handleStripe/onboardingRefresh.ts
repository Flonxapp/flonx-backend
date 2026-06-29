import { Request, Response } from 'express';
import httpStatus from 'http-status';
import config from '../config';
import AppError from '../error/appError';
import stripe from '../utilities/stripe';

const onboardingRefresh = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).send('Missing accountId');
    }
    const accountLink = await stripe.accountLinks.create({
      account: accountId as string,
      refresh_url: `${config.stripe.onboarding_refresh_url}?accountId=${accountId}`,
      return_url: config.stripe.onboarding_refresh_url,
      type: 'account_onboarding',
    });

    res.redirect(accountLink.url);
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Update onboarding link failed');
  }
};

export default onboardingRefresh;
