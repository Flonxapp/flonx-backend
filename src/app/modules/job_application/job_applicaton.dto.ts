import { z } from 'zod';
import {
  applyJobValidationSchema,
  updateApplicationStatusValidationSchema,
} from './job_applicaiton.validation';

export type ApplyJobDTO = z.infer<typeof applyJobValidationSchema>['body'];

export type UpdateApplicationStatusDTO = z.infer<
  typeof updateApplicationStatusValidationSchema
>['body'];
