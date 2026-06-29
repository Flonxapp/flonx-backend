import express from 'express';
import BartenderController from './bartender.controller';

const router = express.Router();

router.get('/get-all', BartenderController.getAllBartender);
router.get('/get-single/:id', BartenderController.getSingleBartender);
export const bartenderRoutes = router;
