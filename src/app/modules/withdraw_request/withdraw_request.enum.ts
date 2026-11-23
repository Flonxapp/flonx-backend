export const ENUM_WITHDRAW_STATUS = {
  PENDING: 'PENDING', // waiting for admin, amount held
  PROCESSING: 'PROCESSING', // transfer in progress
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED', // amount returned
  REVERSED: 'REVERSED', // reversed in Stripe, amount returned
} as const;

export type TWithdrawStatus =
  (typeof ENUM_WITHDRAW_STATUS)[keyof typeof ENUM_WITHDRAW_STATUS];

// After this a PROCESSING request counts as stuck and can be retried
export const STALE_PROCESSING_MS = 5 * 60 * 1000;
