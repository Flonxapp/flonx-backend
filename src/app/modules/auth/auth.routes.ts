import { Router } from 'express';
import validateRequest from '../../middlewares/validateRequest';

import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import authControllers from './auth.controller';
import authValidations from './auth.validation';

const router = Router();

router.post(
  '/login',
  validateRequest(authValidations.loginValidationSchema),
  authControllers.loginUser,
);
router.post(
  '/google-login',
  validateRequest(authValidations.googleSignUpValidationSchema),
  authControllers.googleLogin,
);
router.post(
  '/change-password',
  auth(
    USER_ROLE.bartender,
    USER_ROLE.customer,
    USER_ROLE.superAdmin,
    USER_ROLE.venueOwner,
  ),
  validateRequest(authValidations.changePasswordValidationSchema),
  authControllers.changePassword,
);
router.post(
  '/refresh-token',
  auth(USER_ROLE.bartender, USER_ROLE.customer, USER_ROLE.superAdmin),
  validateRequest(authValidations.refreshTokenValidationSchema),
  authControllers.refreshToken,
);

router.post(
  '/forget-password',
  validateRequest(authValidations.forgetPasswordValidationSchema),
  authControllers.forgetPassword,
);
router.post(
  '/reset-password',
  validateRequest(authValidations.resetPasswordValidationSchema),
  authControllers.resetPassword,
);
router.post(
  '/verify-reset-otp',
  validateRequest(authValidations.verifyResetOtpValidationSchema),
  authControllers.verifyResetOtp,
);

router.post(
  '/resend-reset-code',
  validateRequest(authValidations.resendResetCodeValidationSchema),
  authControllers.resendResetCode,
);

router.post(
  '/resend-verify-code',
  validateRequest(authValidations.resendResetCodeValidationSchema),
  authControllers.resendResetCode,
);

router.post('/guest', authControllers.guestAuth);
router.post('/logout', authControllers.logout);
export const authRoutes = router;
