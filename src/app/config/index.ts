import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

const DEFAULT_CORS_ORIGINS = [
  'https://flonxapp.com',
  'https://admin.flonxapp.com',
  'https://venue.flonxapp.com',
  'https://bartender.flonxapp.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

const list = (value: string | undefined, fallback: string[]) =>
  value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : fallback;

export default {
  NODE_ENV: process.env.NODE_ENV,
  is_production: process.env.NODE_ENV === 'production',
  // require the guestSecret on guest logins (see auth.services guestAuth)
  guest_secret_enforced: process.env.GUEST_SECRET_ENFORCED !== 'false',
  // comma separated; used by both the API and socket.io
  cors_origins: list(process.env.CORS_ORIGINS, DEFAULT_CORS_ORIGINS),
  // number of proxies in front of the app (nginx = 1)
  trust_proxy: Number(process.env.TRUST_PROXY ?? 1),
  rate_limit: {
    api_per_minute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 300),
    login_per_15_minutes: Number(process.env.LOGIN_LIMIT_PER_15_MIN ?? 10),
    otp_per_15_minutes: Number(process.env.OTP_LIMIT_PER_15_MIN ?? 10),
  },
  port: process.env.PORT,
  domain: process.env.DOMAIN,
  database_url: process.env.DATABASE_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  base_url: process.env.BASE_URL,
  default_pass: process.env.DEFAULT_PASS,
  // Google OAuth client IDs (web, iOS, Android) accepted as ID-token audience
  google_client_ids: [
    process.env.GOOGLE_CLIENT_ID,
    process.env.WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((v): v is string => !!v),
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  reset_password_ui_link: process.env.RESET_PASSWORD_UI_LINK,
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  super_admin_email: process.env.SUPER_ADMIN_EMAIL,
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
  stripe: {
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_campaign_run_payment_success_url:
      process.env.STRIPE_CAMPAIGN_RUN_PAYMENT_SUCCESS_URL,
    stripe_campaign_run_payment_cancel_url:
      process.env.STRIPE_CAMPAIGN_RUN_PAYMENT_CANCEL_URL,
    stripe_order_payment_success_url:
      process.env.STRIPE_ORDER_PAYMENT_SUCCESS_URL,
    stripe_order_payment_cancel_url:
      process.env.STRIPE_ORDER_PAYMENT_CANCEL_URL,
    stripe_tip_payment_success_url: process.env.STRIPE_TIP_PAYMENT_SUCCESS_URL,
    stripe_tip_payment_cancel_url: process.env.STRIPE_TIP_PAYMENT_CANCEL_URL,
    stripe_proceed_shipping_payment_success:
      process.env.STRIPE_PROCEED_SHIPPING_PAYMENT_SUCCESS,
    stripe_proceed_shipping_payment_cancel:
      process.env.STRIPE_PROCEED_SHIPPING_PAYMENT_CANCEL,
    stripe_proceed_shipping_payment_for_campaign_offer_success:
      process.env.STRIPE_PROCEED_SHIPPING_PAYMENT__FOR_CAMPAIGN_OFFER_SUCCESS,
    stripe_proceed_shipping_payment_for_campaign_offer_cancel:
      process.env.STRIPE_PROCEED_SHIPPING_PAYMENT__FOR_CAMPAIGN_OFFER_CANCEL,
    webhook_endpoint_secret: process.env.WEBHOOK_ENDPOINT_SECRET,
    webhook_endpoint_secret_for_connected:
      process.env.WEBHOOK_ENDPOINT_SECRET_FOR_CONNECTED,
    onboarding_return_url: process.env.ONBOARDING_RETURN_URL,
    onboarding_return_url_for_business:
      process.env.ONBOARDING_RETURN_URL_FOR_BUSINESS,
    onboarding_refresh_url: process.env.ONBOARDING_REFRESH_URL,
  },
  paypal: {
    client_id: process.env.PAYPAL_CLIENT_ID,
    client_secret: process.env.PAYPAL_CLIENT_SECRET,
    mode: process.env.PAYPAL_MODE,
    paypal_campaign_run_payment_success_url:
      process.env.PAYPAL_CAMPAIGN_RUN_PAYMENT_SUCCESS_URL,
    paypal_campaign_run_payment_cancel_url:
      process.env.PAYPAL_CAMPAIGN_RUN_PAYMENT_CANCEL_URL,
    payment_capture_url: process.env.PAYPAL_PAYMENT_CAPTURE_URL,
    base_url: process.env.PAYPAL_BASE_URL,
    paypal_onboarding_success: process.env.PAYPAL_ONBOARDING_SUCCESS,
    paypal_onboarding_failed: process.env.PAYPAL_ONBOARDING_FAILED,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  smtp: {
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_service: process.env.SMTP_SERVICE,
    smtp_mail: process.env.SMTP_MAIL,
    smtp_pass: process.env.SMTP_PASS,
    // where contact-us form messages are delivered (defaults to SMTP_MAIL)
    contact_us_email: process.env.CONTACT_US_EMAIL,
    name: process.env.SERVICE_NAME,
  },
  resend: {
    api_key: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM,
  },
  shippo: {
    api_key: process.env.SHIPPO_API_KEY,
  },
  app: {
    // open (queued + in progress) orders allowed per venue
    max_concurrent_orders: Number(process.env.MAX_CONCURRENT_ORDERS ?? 40),
    // unpaid orders older than this are cancelled
    pending_order_ttl_minutes: Number(
      process.env.PENDING_ORDER_TTL_MINUTES ?? 30,
    ),
  },
  wallet: {
    // platform's % of each order
    platform_fee_percentage: Number(process.env.PLATFORM_FEE_PERCENTAGE ?? 10),
    // platform's % of each tip
    tip_platform_fee_percentage: Number(
      process.env.TIP_PLATFORM_FEE_PERCENTAGE ?? 0,
    ),
    min_withdraw_amount: Number(process.env.MIN_WITHDRAW_AMOUNT ?? 10),
    // daily | weekly | monthly
    connected_account_payout_interval: (process.env
      .CONNECTED_ACCOUNT_PAYOUT_INTERVAL || 'daily') as
      | 'daily'
      | 'weekly'
      | 'monthly',
  },
};
