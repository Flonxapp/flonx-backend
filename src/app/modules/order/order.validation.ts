import { z } from 'zod';

export const tipToBartenderValidation = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .min(1, { message: 'Amount must be greater than 0' })
      .max(1000, { message: 'Amount exceeds the maximum allowed tip' }),
  }),
});
