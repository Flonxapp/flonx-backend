import { z } from 'zod';

export const addRatingValidationSchema = z.object({
  body: z.object({
    rating: z.number({ required_error: 'Rating is required' }),
  }),
});
