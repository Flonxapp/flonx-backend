import { z } from 'zod';
const locationSchema = z.object({
  type: z.literal('Point'),
  coordinates: z
    .array(z.number())
    .length(2, 'Coordinates must be [longitude, latitude]'),
});
export const addVenueInfoValidationSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }),
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'Email must be a valid email' }),
    phone: z.string({ required_error: 'Phone number is required' }),
    address: z.string({ required_error: 'Address is required' }),
    location: locationSchema,
    logo: z.string().optional(),
    isOpen: z.boolean().optional(),
  }),
});
export const updateVenueValidationSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).optional(),
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'Email must be a valid email' })
      .optional(),
    phone: z.string({ required_error: 'Phone number is required' }).optional(),
    address: z.string({ required_error: 'Address is required' }).optional(),
    location: locationSchema.optional(),
    logo: z.string().optional(),
    isOpen: z.boolean().optional(),
  }),
});

const VenueValidations = {
  addVenueInfoValidationSchema,
  updateVenueValidationSchema,
};

export default VenueValidations;
