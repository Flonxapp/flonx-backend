/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import cookieParser from 'cookie-parser';
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
const app: Application = express();
// parser
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());

app.use(
  cors({
    origin: [
      'http://45.55.251.203:3001',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://admin.flonxapp.com',
      'https://venue.flonxapp.com',
      'https://bartender.flonxapp.com',
      'https://flonxapp.com',
    ],
    // origin: '*',
    credentials: true,
  }),
);
app.use('/uploads', express.static('uploads'));
// application routers ----------------
app.use(rateLimiters.apiLimiter);
app.use('/api/v1', router);
app.post('/contact-us', sendContactUsEmail);

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

app.post('/generate-qr-code/:id', auth(...allRoles), async (req, res) => {
  const { id } = req.params;
  try {
    const qrCodeUrl = await generateVenueQRCode(id);
    res.json({ qrCodeUrl });
  } catch (error) {
    res.status(500).json({ message: 'Error generating QR code' });
  }
});

// global error handler
app.use(globalErrorHandler);
// not found
app.use(notFound);

export default app;
