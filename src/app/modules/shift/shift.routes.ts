import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import ShiftRequestController from './shift.controller';
import { createShiftRequestSchema } from './shift.validation';

const router = express.Router();

router.post(
  '/send-request',
  auth(USER_ROLE.venueOwner),
  validateRequest(createShiftRequestSchema),
  ShiftRequestController.sendShiftRequestToBartender,
);

router.get(
  '/my-shift',
  auth(USER_ROLE.bartender, USER_ROLE.venueOwner),
  ShiftRequestController.getMyShiftRequest,
);
router.patch(
  '/accept-reject/:id',
  auth(USER_ROLE.bartender),
  ShiftRequestController.acceptRejectShiftRequest,
);

router.get(
  '/current-shift',
  auth(USER_ROLE.bartender),
  ShiftRequestController.getCurrentShift,
);

router.get(
  '/single-shift/:id',
  // auth(USER_ROLE.bartender, USER_ROLE.venueOwner),
  ShiftRequestController.getSingleShift,
);

router.delete(
  '/decline-shift/:id',
  auth(USER_ROLE.venueOwner),
  ShiftRequestController.declineShift,
);

export const shiftRoutes = router;
