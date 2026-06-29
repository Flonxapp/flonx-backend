import { z } from 'zod';

const makeWithdrawValidationSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .min(1, 'Amount must be at least 1'),
  }),
});

const PaymentValidations = {
  makeWithdrawValidationSchema,
};
export default PaymentValidations;
