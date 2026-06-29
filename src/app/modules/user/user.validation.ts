import { z } from 'zod';
import { ENUM_USER_STATUS } from '../../utilities/enum';
import { USER_ROLE } from './user.constant';
const locationSchema = z.object({
  type: z.literal('Point'),
  coordinates: z
    .array(z.number())
    .length(2, 'Coordinates must be [longitude, latitude]'),
});
const registerUserValidationSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'Name is required',
      invalid_type_error: 'Name must be a string',
    }),
    email: z.string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    }),
    address: z.string({ required_error: 'Address is required' }).optional(),
    location: locationSchema.optional(),
    password: z.string({ required_error: 'Password is required' }),
    confirmPassword: z.string({
      required_error: 'Confirm password is required',
    }),
    role: z.nativeEnum(USER_ROLE),
    skills: z.array(z.string()).optional(),
  }),
});

const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z.string({ required_error: 'Old password is required' }),
    newPassword: z.string({ required_error: 'Password is required' }),
  }),
});

// refresh token validation schema -----------
const refreshTokenValidationSchema = z.object({
  cookies: z.object({
    refreshToken: z.string({ required_error: 'Refresh token is required' }),
  }),
});

// forget password validation schema
const forgetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'User email is required' }),
  }),
});
// reset password validation schema
const resetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'User email is required' }),
    newPassword: z.string({ required_error: 'New password is required' }),
  }),
});

const verifyCodeValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
    verifyCode: z.number({ required_error: 'Verify code  is required' }),
  }),
});

const resendVerifyCodeSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
  }),
});

const changeUserStatus = z.object({
  body: z.object({
    status: z.enum(Object.values(ENUM_USER_STATUS) as [string, ...string[]]),
  }),
});

const deleteUserAccountValidationSchema = z.object({
  body: z.object({
    password: z.string({ required_error: 'Password is required' }),
    reasonForLeaving: z.string({
      required_error: 'Reason for leaving is required',
    }),
  }),
});

export const updateUserProfileValidationSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    profile_image: z.string().optional(),
  }),
});

const userValidations = {
  changePasswordValidationSchema,
  refreshTokenValidationSchema,
  forgetPasswordValidationSchema,
  resetPasswordValidationSchema,
  verifyCodeValidationSchema,
  resendVerifyCodeSchema,
  changeUserStatus,
  deleteUserAccountValidationSchema,
  registerUserValidationSchema,
  updateUserProfileValidationSchema,
};

export default userValidations;
