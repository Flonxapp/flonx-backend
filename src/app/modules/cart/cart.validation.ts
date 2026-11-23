import { z } from 'zod';

const addToCartValidationSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product id is required' }),
    quantity: z
      .number({ required_error: 'Quantity is required' })
      .int('Quantity must be a whole number')
      .min(1, 'Quantity must be at least 1')
      .max(99, 'Quantity is too large'),
  }),
});

const removeCartItemValidationSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product id is required' }),
  }),
});
const cartValidations = {
  addToCartValidationSchema,
  removeCartItemValidationSchema,
};

export default cartValidations;
