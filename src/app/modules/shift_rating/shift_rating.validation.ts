import { z } from 'zod';

export const addRatingValidationSchema = z.object({
  body: z.object({
    rating: z.number({ required_error: 'Rating is required' }),
    bartender: z.string({ required_error: 'Bartender ID is required' }),
    shift: z.string({ required_error: 'Shift ID is required' }),
  }),
});
