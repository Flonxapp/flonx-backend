import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import StripeController from './stripe.controller';

const router = express.Router();

router.post(
  '/create-onboarding-link',
  auth(USER_ROLE.venueOwner),
  StripeController.createOnboardingLink,
);
router.post(
  '/update-connected-account',
  auth(USER_ROLE.venueOwner),

  StripeController.updateOnboardingLink,
);
router.post(
  '/make-withdraw',
  auth(USER_ROLE.venueOwner),

  StripeController.withdrawMoney,
);
router.post(
  '/remove-payment-info',
  auth(USER_ROLE.customer),
  StripeController.detachPaymentMethod,
);
export const stripeRoutes = router;
