/* eslint-disable no-unused-vars */
export enum TRANSACTION_TYPE {
  PAYMENT = 'PAYMENT', // customer paid
  EARNING = 'EARNING', // added to venue owner wallet
  PLATFORM_FEE = 'PLATFORM_FEE',
  TRANSFER = 'TRANSFER', // withdrawal sent to venue owner's Stripe
  PAYOUT = 'PAYOUT', // Stripe to venue owner's bank
  REFUND = 'REFUND',
  BID_ACCEPT = 'BID_ACCEPT', // old, not used
}

export const ENUM_TRANSACTION_REASON = {
  ORDER: 'ORDER',
  TIP: 'TIP',
  WITHDRAWAL: 'WITHDRAWAL',
  WITHDRAWAL_REVERSED: 'WITHDRAWAL_REVERSED',
  ORDER_REFUND_REVERSAL: 'ORDER_REFUND_REVERSAL',
  ORDER_REFUND: 'ORDER_REFUND',
  MANUAL_TRANSFER: 'MANUAL_TRANSFER', // made from the Stripe dashboard
} as const;

export enum TRANSACTION_STATUS {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

// Money in or out for whoever owns the record. NONE = record only.
export enum TRANSACTION_DIRECTION {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  NONE = 'NONE',
}

export const deriveTransactionDirection = (
  type: string,
  reason?: string,
): TRANSACTION_DIRECTION => {
  switch (type) {
    case TRANSACTION_TYPE.PAYMENT:
      return TRANSACTION_DIRECTION.DEBIT;
    case TRANSACTION_TYPE.EARNING:
    case TRANSACTION_TYPE.PLATFORM_FEE:
      return TRANSACTION_DIRECTION.CREDIT;
    case TRANSACTION_TYPE.TRANSFER:
      return reason === ENUM_TRANSACTION_REASON.MANUAL_TRANSFER
        ? TRANSACTION_DIRECTION.NONE
        : TRANSACTION_DIRECTION.DEBIT;
    case TRANSACTION_TYPE.REFUND:
      return reason === ENUM_TRANSACTION_REASON.ORDER_REFUND_REVERSAL
        ? TRANSACTION_DIRECTION.DEBIT
        : TRANSACTION_DIRECTION.CREDIT;
    default:
      return TRANSACTION_DIRECTION.NONE;
  }
};
