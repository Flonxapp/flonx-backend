import { z } from 'zod';

export const applyJobValidationSchema = z.object({
  body: z.object({}).optional(),
});

export const updateApplicationStatusValidationSchema = z.object({
  body: z.object({
    isAccepted: z.boolean({
      required_error: 'isAccepted is required',
    }),
  }),
});

const JobApplicationValidations = {
  applyJobValidationSchema,
  updateApplicationStatusValidationSchema,
};

export default JobApplicationValidations;
