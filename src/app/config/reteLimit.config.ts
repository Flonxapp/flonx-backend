import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '.';

const tooMany = (message: string) => ({ success: false, message });

const ipKey = (req: Request) => ipKeyGenerator(req.ip || '');

// Logged-in users are limited per account, so customers sharing a venue's
// Wi-Fi don't use up each other's limit. Only a valid token counts.
const userOrIpKey = (req: Request) => {
  let token = req.headers.authorization;
  if (token) {
    if (token.startsWith('Bearer ')) token = token.slice(7);
    try {
      const decoded = jwt.verify(
        token.trim(),
        config.jwt_access_secret as string,
      ) as JwtPayload;
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // fall back to IP
    }
  }
  return ipKey(req);
};

// email + IP, so one attacker can't lock a user out from everywhere
const emailAndIpKey = (req: Request) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  return email ? `${email}|${ipKey(req)}` : ipKey(req);
};

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rate_limit.api_per_minute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: tooMany('Too many requests. Please try again in a minute.'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rate_limit.login_per_15_minutes,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: emailAndIpKey,
  skipSuccessfulRequests: true,
  message: tooMany('Too many login attempts. Please try again later.'),
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rate_limit.otp_per_15_minutes,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: emailAndIpKey,
  message: tooMany('Too many code requests. Please try again later.'),
});
