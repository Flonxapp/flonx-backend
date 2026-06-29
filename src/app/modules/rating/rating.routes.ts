import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import RatingController from './rating.controller';
import { addRatingValidationSchema } from './rating.validation';

const router = express.Router();

router.post(
  '/add-rating',
  auth(USER_ROLE.customer),
  validateRequest(addRatingValidationSchema),
  RatingController.addRating,
);

export const ratingRoutes = router;
