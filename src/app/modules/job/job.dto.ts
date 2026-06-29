import { z } from 'zod';
import {
  createJobValidationSchema,
  updateJobValidationSchema,
} from './job.validation';

export type CreateJobDTO = z.infer<typeof createJobValidationSchema>['body'];

export type UpdateJobDTO = z.infer<typeof updateJobValidationSchema>['body'];
