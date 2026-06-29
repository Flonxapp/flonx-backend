import {
  apiLimiter,
  authLimiter,
  otpLimiter,
} from '../config/reteLimit.config';

export const rateLimiters = {
  apiLimiter,
  authLimiter,
  otpLimiter,
};
