import { Router } from 'express';
import { uploadFile } from '../../aws/multer-s3-uploader';
import auth from '../../middlewares/auth';
import parseJsonBody from '../../middlewares/parseJsonBody';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from './user.constant';
import userControllers from './user.controller';
import userValidations from './user.validation';

const router = Router();

router.post('/register-user', userControllers.registerUser);

router.post(
  '/verify-code',
  validateRequest(userValidations.verifyCodeValidationSchema),
  userControllers.verifyCode,
);

router.post(
  '/resend-verify-code',
  validateRequest(userValidations.resendVerifyCodeSchema),
  userControllers.resendVerifyCode,
);

router.patch(
  '/block-unblock/:id',
  auth(USER_ROLE.superAdmin),
  userControllers.changeUserStatus,
);

router.patch(
  '/update-profile',
  auth(
    USER_ROLE.bartender,
    USER_ROLE.venueOwner,
    USER_ROLE.superAdmin,
    USER_ROLE.customer,
  ),
  uploadFile(),
  parseJsonBody(),
  validateRequest(userValidations.updateUserProfileValidationSchema),
  userControllers.updateUserProfile,
);

router.get(
  '/user-profile',
  auth(
    USER_ROLE.bartender,
    USER_ROLE.venueOwner,
    USER_ROLE.superAdmin,
    USER_ROLE.customer,
  ),
  userControllers.getUserProfile,
);

router.delete(
  '/delete-account',
  auth(USER_ROLE.bartender, USER_ROLE.venueOwner, USER_ROLE.customer),
  userControllers.deleteAccount,
);
export const userRoutes = router;
