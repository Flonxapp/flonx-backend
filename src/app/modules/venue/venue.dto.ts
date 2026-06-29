import { z } from 'zod';
import {
  addVenueInfoValidationSchema,
  updateVenueValidationSchema,
} from './venue.validation';

export type AddVenueInfoDTO = z.infer<
  typeof addVenueInfoValidationSchema
>['body'];
export type UpdateVenueDTO = z.infer<
  typeof updateVenueValidationSchema
>['body'];
