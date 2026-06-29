import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import MetaController from './meta.controller';

const router = express.Router();

router.get(
  '/get-meta-data',
  auth(USER_ROLE.superAdmin),
  MetaController.getMetaData,
);
router.get(
  '/get-activities',
  auth(USER_ROLE.superAdmin),
  MetaController.getActivities,
);
router.get(
  '/get-venue-activities',
  auth(USER_ROLE.venueOwner),
  MetaController.getVenueActivities,
);

router.get(
  '/venue-owner-meta-data',
  auth(USER_ROLE.venueOwner),
  MetaController.getVenueOwnerMetaData,
);

router.get(
  '/venue-owner-earning',
  auth(USER_ROLE.venueOwner),
  MetaController.getVenueOwnerEarning,
);
router.get(
  '/admin-earning',
  auth(USER_ROLE.superAdmin),
  MetaController.getAdminEarning,
);
export const metaRoutes = router;
