import express from 'express';
import VenueOwnerController from './venue_owner.controller';

const router = express.Router();

router.get('/get-all', VenueOwnerController.getAllVenueOwners);
router.get('/get-single/:id', VenueOwnerController.getSingleVenueOwner);

export const venueOwnerRoutes = router;
