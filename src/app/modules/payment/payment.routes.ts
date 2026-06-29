import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import PaymentController from './payment.controller';

const router = express.Router();

router.post(
  '/make-withdraw',
  auth(USER_ROLE.venueOwner),
  PaymentController.makeWithDraw,
);

router.get('/wallet', auth(USER_ROLE.venueOwner), PaymentController.getWallet);

export const paymentRoutes = router;
