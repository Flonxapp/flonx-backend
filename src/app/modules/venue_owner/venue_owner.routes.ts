import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import VenueOwnerController from './venue_owner.controller';

const router = express.Router();

router.get(
  '/get-all',
  auth(USER_ROLE.superAdmin),
  VenueOwnerController.getAllVenueOwners,
);
router.get(
  '/get-single/:id',
  auth(USER_ROLE.superAdmin),
  VenueOwnerController.getSingleVenueOwner,
);

export const venueOwnerRoutes = router;
