import { z } from 'zod';
import { ENUM_PRODUCT_STATUS } from '../../utilities/enum';

export const createVariantValidationSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  color: z.string().optional(),
  size: z.string().optional(),
  weight: z.string().optional(),
  price: z.number().positive('Price must be greater than zero'),
  stock: z.number().min(0, 'Stock cannot be negative').default(0),
  images: z.array(z.string()).optional(),
});

const ProductStatusSchema = z.nativeEnum(ENUM_PRODUCT_STATUS);

export const createProductValidationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Product name is required' })
      .min(3, 'Product name must be at least 3 characters long'),
    description: z
      .string({ required_error: 'Description is required' })
      .min(10, 'Description must be at least 10 characters'),
    category: z
      .string({ required_error: 'Category is required' })
      .min(1, 'Category ID is required'),
    status: ProductStatusSchema.default(ENUM_PRODUCT_STATUS.ACTIVE),
    tags: z.array(z.string().min(1)).optional(),
    slogan: z.string().optional(),
  }),
});

export const updateProductValidationSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, 'Product name must be at least 3 characters long')
      .optional(),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .optional(),
    category: z.string().min(1, 'Category ID is required').optional(),
    brand: z.string().optional(),
    status: ProductStatusSchema.optional(),
    tags: z.array(z.string().min(1)).optional(),
    image: z.string().optional(),
    slogan: z.string().optional(),
  }),
});

const ProductValidations = {
  createProductValidationSchema,
  updateProductValidationSchema,
};

export default ProductValidations;
