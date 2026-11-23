import { Buffer } from 'buffer';
import { createHmac, timingSafeEqual } from 'crypto';
import config from '../config';
import stripe from './stripe';

// The onboarding "refresh" URL is opened by the browser when a Stripe
// onboarding link expires, so it cannot require a login. To stop anyone from
// generating onboarding links for arbitrary accounts, every refresh URL we
// hand to Stripe carries an HMAC of the account id, checked on the way back.
const sign = (accountId: string) =>
  createHmac('sha256', String(config.jwt_access_secret))
    .update(`stripe-onboarding:${accountId}`)
    .digest('hex');

export const isValidOnboardingSignature = (accountId: string, sig: string) => {
  const expected = Buffer.from(sign(accountId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

export const createOnboardingLink = async (accountId: string) => {
  const refreshUrl = new URL(String(config.stripe.onboarding_refresh_url));
  refreshUrl.searchParams.set('accountId', accountId);
  refreshUrl.searchParams.set('sig', sign(accountId));

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl.toString(),
    return_url: String(config.stripe.onboarding_return_url),
    type: 'account_onboarding',
  });
  return link.url;
};
