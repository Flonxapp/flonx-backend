import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import BartenderController from './bartender.controller';

const router = express.Router();

// venue owners search bartenders to hire; admins manage them
router.get(
  '/get-all',
  auth(USER_ROLE.venueOwner, USER_ROLE.superAdmin),
  BartenderController.getAllBartender,
);
// bartender profile (customers see it when tipping, owners when hiring)
router.get(
  '/get-single/:id',
  auth(
    USER_ROLE.customer,
    USER_ROLE.bartender,
    USER_ROLE.venueOwner,
    USER_ROLE.superAdmin,
  ),
  BartenderController.getSingleBartender,
);
export const bartenderRoutes = router;
