import express from 'express';
import { uploadFile } from '../../aws/multer-s3-uploader';
import auth from '../../middlewares/auth';
import parseJsonBody from '../../middlewares/parseJsonBody';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import VenueController from './venue.controller';
import VenueValidations from './venue.validation';

const router = express.Router();

router.post(
  '/add-venue',
  auth(USER_ROLE.venueOwner),
  uploadFile(),
  parseJsonBody(),
  validateRequest(VenueValidations.addVenueInfoValidationSchema),
  VenueController.addVenueInfo,
);

router.patch(
  '/update/:id',
  auth(USER_ROLE.venueOwner),
  uploadFile(),
  parseJsonBody(),
  validateRequest(VenueValidations.updateVenueValidationSchema),
  VenueController.updateVenue,
);

router.get('/get-all', VenueController.getAllVenue);
router.get('/get-single/:id', VenueController.getSingleVenue);
router.get('/my-venue', auth(USER_ROLE.venueOwner), VenueController.getMyVenue);
export const venueRoutes = router;
