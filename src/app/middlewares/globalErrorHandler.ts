import { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import config from '../config';
import AppError from '../error/appError';
import { errorLogger } from '../shared/logger';

const SENSITIVE_KEYS = [
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'token',
  'refreshToken',
  'verifyCode',
  'resetCode',
];

// keep secrets out of the logs
const redact = (body: unknown) => {
  if (!body || typeof body !== 'object') return body;
  const copy: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
  };
  for (const key of SENSITIVE_KEYS) {
    if (key in copy) copy[key] = '[redacted]';
  }
  return copy;
};

const globalErrorHandler: ErrorRequestHandler = (
  err,
  req,
  res,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  next,
) => {
  let statusCode = 500;
  let errorMessage = 'Something went wrong';
  let errorDetails: unknown = {};

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Value';
    errorMessage = `${field} already exists`;
    statusCode = 409;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    errorMessage = err.issues.map((issue) => issue.message).join('. ') + '.';
    errorDetails = { issues: err.issues };
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    errorMessage = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
  } else if (err?.name === 'CastError') {
    statusCode = 400;
    errorMessage = `${err.value} is not a valid ID`;
  } else if (err?.type === 'entity.too.large') {
    statusCode = 413;
    errorMessage = 'Request body is too large';
  }

  errorLogger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    body: redact(req.body),
    params: req.params,
    query: req.query,
  });

  return res.status(statusCode).json({
    success: false,
    message: errorMessage,
    errorDetails,
    // never expose internals in production
    ...(config.is_production ? {} : { stack: err?.stack || null }),
  });
};

export default globalErrorHandler;
