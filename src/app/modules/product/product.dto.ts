import { z } from 'zod';
import {
  createProductValidationSchema,
  updateProductValidationSchema,
} from './product.validation';

export type CreateProductDTO = z.infer<
  typeof createProductValidationSchema
>['body'];
export type UpdateProductDTO = z.infer<
  typeof updateProductValidationSchema
>['body'];
