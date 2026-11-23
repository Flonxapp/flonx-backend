import { logger } from '../shared/logger';

// Settings the API can not run correctly without.
const REQUIRED = [
  'DATABASE_URL',
  'PORT',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'BCRYPT_SALT_ROUNDS',
  'STRIPE_SECRET_KEY',
  'WEBHOOK_ENDPOINT_SECRET',
  'WEBHOOK_ENDPOINT_SECRET_FOR_CONNECTED',
  'ONBOARDING_REFRESH_URL',
  'ONBOARDING_RETURN_URL',
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME',
  'SMTP_MAIL',
  'SMTP_PASS',
];

// In production a missing setting stops the start (PM2 shows the error);
// elsewhere it is only a warning.
const validateEnv = () => {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (!missing.length) return;
  const message = `Missing environment variables: ${missing.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  logger.warn(message);
};

export default validateEnv;
