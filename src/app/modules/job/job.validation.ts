import { z } from 'zod';
import { ENUM_JOB_STATUS } from './job.enum';

const locationSchema = z.object({
  type: z.literal('Point'),
  coordinates: z
    .array(z.number())
    .length(2, 'Coordinates must be [longitude, latitude]'),
});

export const createJobValidationSchema = z.object({
  body: z
    .object({
      title: z.string({ required_error: 'Title is required' }),

      address: z.string({ required_error: 'Address is required' }),

      location: locationSchema,

      // ✅ replaced
      startDateTime: z.string({
        required_error: 'Start date time is required',
      }),

      endDateTime: z.string({
        required_error: 'End date time is required',
      }),

      hourlyRate: z
        .number({
          required_error: 'Hourly rate is required',
        })
        .min(0, 'Hourly rate must be positive'),

      contactNumber: z.string({
        required_error: 'Contact number is required',
      }),

      description: z.string({
        required_error: 'Description is required',
      }),

      status: z
        .enum(Object.values(ENUM_JOB_STATUS) as [string, ...string[]])
        .optional(),
    })
    .refine(
      (data) => new Date(data.endDateTime) > new Date(data.startDateTime),
      {
        message: 'End date time must be greater than start date time',
        path: ['endDateTime'], // error will show under this field
      },
    ),
});

export const updateJobValidationSchema = z.object({
  body: z
    .object({
      title: z.string().optional(),

      address: z.string().optional(),

      location: locationSchema.optional(),

      startDateTime: z.string().optional(),

      endDateTime: z.string().optional(),

      hourlyRate: z.number().min(0).optional(),

      contactNumber: z.string().optional(),

      description: z.string().optional(),

      status: z
        .enum(Object.values(ENUM_JOB_STATUS) as [string, ...string[]])
        .optional(),
    })
    .refine(
      (data) => {
        if (data.startDateTime && data.endDateTime) {
          return new Date(data.endDateTime) > new Date(data.startDateTime);
        }
        return true;
      },
      {
        message: 'End date time must be greater than start date time',
        path: ['endDateTime'],
      },
    ),
});

const JobValidations = {
  createJobValidationSchema,
  updateJobValidationSchema,
};

export default JobValidations;
