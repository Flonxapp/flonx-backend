import { z } from 'zod';

const loginValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
    password: z.string({ required_error: 'Password is required' }),
  }),
});

const googleSignUpValidationSchema = z.object({
  body: z.object({
    // ID token from Google Sign-In; verified server-side
    idToken: z.string({ required_error: 'Google idToken is required' }).min(1),
  }),
});

const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z.string({ required_error: 'Old password is required' }),
    newPassword: z.string({ required_error: 'Password is required' }),
    confirmNewPassword: z.string({
      required_error: 'Confirm password is required',
    }),
  }),
});

// refresh token validation schema -----------
// refresh token may come in the JSON body (mobile / SPA) or a cookie
// (presence is checked in the service)
const refreshTokenValidationSchema = z.object({
  body: z.object({ refreshToken: z.string().optional() }).optional(),
  cookies: z.object({ refreshToken: z.string().optional() }).optional(),
});

// forget password validation schema
const forgetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
  }),
});
// reset password validation schema
const resetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
    password: z.string({ required_error: 'Password is required' }),
    confirmPassword: z.string({
      required_error: 'Confirm password is required',
    }),
  }),
});

const verifyResetOtpValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
    resetCode: z.number({
      required_error: 'Reset code is required',
      invalid_type_error: 'Reset code must be number',
    }),
  }),
});

const resendResetCodeValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
  }),
});

const changeEmailValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
    password: z.string({ required_error: 'Password is reqruied' }),
  }),
});
const verifyEmailCodeValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }),
    code: z.number({ required_error: 'Code is reqruied' }),
  }),
});

const authValidations = {
  loginValidationSchema,
  changePasswordValidationSchema,
  refreshTokenValidationSchema,
  forgetPasswordValidationSchema,
  resetPasswordValidationSchema,
  verifyResetOtpValidationSchema,
  resendResetCodeValidationSchema,
  googleSignUpValidationSchema,
  changeEmailValidationSchema,
  verifyEmailCodeValidationSchema,
};

export default authValidations;
