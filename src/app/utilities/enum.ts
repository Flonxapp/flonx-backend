export const ENUM_PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
} as const;

export const ENUM_PAYMENT_STATUS = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  REFUNDED: 'Refunded',
};

export const ENUM_TIP_BY = {
  PROFILE_BALANCE: 'Profile balance',
  CREDIT_CARD: 'Credit card',
  PAYPAL: 'Paypal',
};

export const ENUM_USER_STATUS = {
  IN_PROGRESS: 'in-progress',
  BLOCKED: 'blocked',
};

export const ENUM_DELIVERY_OPTION = {
  EMAIL: 'Email',
  SHIPPING_ADDRESS: 'Shipping Address',
};

export const ENUM_REDEEM_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
};

export const ENUM_PAYMENT_BY = {
  CREDIT_CARD: 'Credit Card',
  PAYPAL: 'Paypal',
  ACH: 'ACH',
  CHECK: 'Check',
};
export const ENUM_PAYMENT_METHOD = {
  STRIPE: 'Stripe',
  PAYPAL: 'Paypal',
};

export const ENUM_INVITE_STATUS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
};

export const ENUM_TRANSACTION_STATUS = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
};

export const ENUM_PAYMENT_PURPOSE = {
  CAMPAIGN_RUN: 'Campaign Run',
  ORDER: 'Order',
  PROCEED_CAMPAIGN_OFFER_DELIVERY: 'PROCEED_CAMPAIGN_OFFER_DELIVERY',
  TIP: 'Tip',
};

export const CAMPAIGN_STATUS = {
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const TRANSACTION_STATUS = {
  SUCCESSFUL: 'Successful',
  FAILED: 'Failed',
};

export const GENDER = {
  MALE: 'Male',
  FEMALE: 'Female',
  Other: 'Other',
};

export const INTEREST_STATUS = {
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
  IN_PROGRESS: 'In-Progress',
};

export const ENUM_SKIP_VALUE = {
  interestedCategoryStatus: 'interestedCategoryStatus',
  shippingInformationStatus: 'shippingInformationStatus',
  currentShareReviewStatus: 'currentShareReviewStatus',
  profileDetailStatus: 'profileDetailStatus',
  socailInfoStatus: 'socailInfoStatus',
};

export const ENUM_SENDER_TYPE = {
  REVIEWER: 'Reviewer',
  BUSSINESS_OWNER: 'BussinessOwner',
  PLATFORM: 'Platform',
};
export const ENUM_RECEIVER_TYPE = {
  REVIEWER: 'Reviewer',
  BUSSINESS_OWNER: 'BussinessOwner',
};

export const ENUM_REF_TYPE = {
  BUSSINESS: 'Bussiness',
  REVIEWER: 'Reviewer',
  ORDER: 'Order',
  RETURN: 'Return',
};
