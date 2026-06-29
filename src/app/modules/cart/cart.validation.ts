import { z } from 'zod';

const addToCartValidationSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product id is required' }),
    quantity: z.number({ required_error: 'Quantity is required' }),
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
