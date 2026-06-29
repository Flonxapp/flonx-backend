import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import { addRatingValidationSchema } from './shiftRating.validation';
import ShiftRatingController from './shift_rating.controller';

const router = express.Router();

router.post(
  '/add-rating',
  auth(USER_ROLE.venueOwner),
  validateRequest(addRatingValidationSchema),
  ShiftRatingController.addRating,
);

export const shiftRatingRoutes = router;
