import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import WithdrawRequestController from './withdraw_request.controller';
import WithdrawRequestValidations from './withdraw_request.validation';

const router = express.Router();

// venue owner
router.get(
  '/wallet',
  auth(USER_ROLE.venueOwner),
  WithdrawRequestController.getWallet,
);
router.post(
  '/request',
  auth(USER_ROLE.venueOwner),
  validateRequest(WithdrawRequestValidations.createWithdrawRequestValidation),
  WithdrawRequestController.createWithdrawRequest,
);
router.get(
  '/my-requests',
  auth(USER_ROLE.venueOwner),
  WithdrawRequestController.getMyWithdrawRequests,
);

// admin
router.get(
  '/all',
  auth(USER_ROLE.superAdmin),
  WithdrawRequestController.getAllWithdrawRequests,
);
router.patch(
  '/approve/:id',
  auth(USER_ROLE.superAdmin),
  WithdrawRequestController.approveWithdrawRequest,
);
router.patch(
  '/reject/:id',
  auth(USER_ROLE.superAdmin),
  validateRequest(WithdrawRequestValidations.rejectWithdrawRequestValidation),
  WithdrawRequestController.rejectWithdrawRequest,
);

router.get(
  '/single/:id',
  auth(USER_ROLE.venueOwner, USER_ROLE.superAdmin),
  WithdrawRequestController.getSingleWithdrawRequest,
);

export const withdrawRequestRoutes = router;
