import { Buffer } from 'buffer';
import { NextFunction, Request, Response } from 'express';
import { sanitizeQueryObject } from '../builder/queryBuilder.utils';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !Buffer.isBuffer(v);

// Removes Mongo operator keys ("$ne", "$gt", "$where", ...) from req.query and
// JSON/urlencoded bodies, so values like `?email[$ne]=x` or
// `{"email": {"$ne": null}}` can never reach a query as operators.
// Raw (Buffer) bodies, used by the Stripe webhooks, are left untouched.
const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  if (isPlainObject(req.query)) {
    req.query = sanitizeQueryObject(req.query) as Request['query'];
  }
  if (isPlainObject(req.body)) {
    req.body = sanitizeQueryObject(req.body);
  }
  next();
};

export default sanitizeInput;
