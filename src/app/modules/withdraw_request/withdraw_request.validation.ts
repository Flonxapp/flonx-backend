import { z } from 'zod';

const createWithdrawRequestValidation = z.object({
  body: z.object({
    amount: z
      .number({
        required_error: 'Amount is required',
        invalid_type_error: 'Amount must be a number',
      })
      .positive('Amount must be greater than 0')
      .max(1_000_000, 'Amount is too large')
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
        message: 'Amount can have at most 2 decimal places',
      }),
    note: z.string().trim().max(500).optional(),
  }),
});

const rejectWithdrawRequestValidation = z.object({
  body: z.object({
    reason: z
      .string({ required_error: 'Reject reason is required' })
      .trim()
      .min(3, 'Please write a reason (at least 3 characters)')
      .max(1000),
  }),
});

const WithdrawRequestValidations = {
  createWithdrawRequestValidation,
  rejectWithdrawRequestValidation,
};

export default WithdrawRequestValidations;
