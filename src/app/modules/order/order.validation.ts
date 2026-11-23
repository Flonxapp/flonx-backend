import { z } from 'zod';

export const cancelOrderValidation = z.object({
  body: z
    .object({
      reason: z.string().trim().max(500).optional(),
    })
    .optional(),
});

export const tipToBartenderValidation = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .min(1, { message: 'Amount must be greater than 0' })
      .max(1000, { message: 'Amount exceeds the maximum allowed tip' }),
  }),
});

export const changeOrderStatusValidation = z.object({
  body: z.object({
    status: z.enum(['IN_PROGRESS', 'READY_FOR_PIC', 'PICKED', 'CANCELLED'], {
      errorMap: () => ({ message: 'Invalid order status' }),
    }),
  }),
});
