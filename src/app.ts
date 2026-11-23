/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import cookieParser from 'cookie-parser';
import sanitizeInput from './app/middlewares/sanitizeInput';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import httpStatus from 'http-status';
import {
  generateMultiplePresignedUrls,
  generatePresignedUrl,
} from './app/aws/presignedUrlGenerator';
import AppError from './app/error/appError';

import './app/events/listeners';
import handleConnectedAccountWebhook from './app/handleStripe/connectedAccountWebhook';
import onboardingRefresh from './app/handleStripe/onboardingRefresh';
import handleWebhook from './app/handleStripe/webhook';
import { generateVenueQRCode } from './app/helper/generateVenueQrCode';
import sendContactUsEmail from './app/helper/sendContactUsEmail';
import auth from './app/middlewares/auth';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { rateLimiters } from './app/middlewares/ratelimiter.middleware';
import { USER_ROLE } from './app/modules/user/user.constant';
import router from './app/routes';
import config from './app/config';
import { Venue } from './app/modules/venue/venue.model';
import mongoose, { Types } from 'mongoose';
const app: Application = express();

// real client IP behind nginx / load balancer (needed for rate limiting)
app.set('trust proxy', config.trust_proxy);
app.disable('x-powered-by');

app.post(
  '/flonx-webhook',
  express.raw({ type: 'application/json' }),
  handleWebhook,
);
app.post(
  '/flonx-webhook-connected-account',
  express.raw({ type: 'application/json' }),
  handleConnectedAccountWebhook,
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);
app.use(helmet());

app.use(cors({ origin: config.cors_origins, credentials: true }));

app.get('/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'db_down' });
});
app.use('/uploads', express.static('uploads'));
// application routers ----------------
app.use(rateLimiters.apiLimiter);
app.use('/api/v1', router);
app.post('/contact-us', rateLimiters.otpLimiter, sendContactUsEmail);

// onboarding refresh --------------
router.get('/stripe/onboarding/refresh', onboardingRefresh);

// for s3 bucket--------------
const allRoles = Object.values(USER_ROLE);

app.post(
  '/generate-presigned-url',
  auth(...allRoles),
  async (req, res, next) => {
    const { fileType, fileCategory } = req.body;
    if (!fileType || !fileCategory) {
      return next(
        new AppError(
          httpStatus.BAD_REQUEST,
          'File type and file category is required',
        ),
      );
    }

    try {
      const result = await generatePresignedUrl({ fileType, fileCategory });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  '/generate-multiple-presigned-urls',
  auth(...allRoles),
  async (req, res, next) => {
    const { files } = req.body;

    try {
      const result = await generateMultiplePresignedUrls(files);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  '/generate-qr-code/:id',
  auth(USER_ROLE.venueOwner, USER_ROLE.superAdmin),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid venue id');
      }
      const filter: Record<string, unknown> = { _id: id };
      if (req.user.role === USER_ROLE.venueOwner) {
        filter.venueOwner = req.user.profileId;
      }
      const venue = await Venue.findOne(filter).select('_id');
      if (!venue) {
        throw new AppError(httpStatus.NOT_FOUND, 'Venue not found');
      }
      const qrCodeUrl = await generateVenueQRCode(id);
      await Venue.updateOne({ _id: id }, { qrCodeUrl });
      res.json({ qrCodeUrl });
    } catch (error) {
      next(error);
    }
  },
);

// global error handler
app.use(globalErrorHandler);
// not found
app.use(notFound);

export default app;
