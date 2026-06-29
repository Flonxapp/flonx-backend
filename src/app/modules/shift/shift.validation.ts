import mongoose from 'mongoose';
import { z } from 'zod';

const objectIdSchema = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  });

export const createShiftRequestSchema = z.object({
  body: z
    .object({
      venueOwner: objectIdSchema.optional(),
      venue: objectIdSchema.optional(),
      bartender: objectIdSchema.optional(),

      startDateTime: z
        .string()
        .datetime({ message: 'Invalid startDateTime format' }),

      endDateTime: z
        .string()
        .datetime({ message: 'Invalid endDateTime format' }),

      note: z.string().trim().optional(),
      shiftRate: z
        .number()
        .min(0, { message: 'shiftRate must be non-negative' }),
    })
    .refine(
      (data) => new Date(data.endDateTime) > new Date(data.startDateTime),
      {
        message: 'endDateTime must be greater than startDateTime',
        path: ['endDateTime'],
      },
    ),
});
