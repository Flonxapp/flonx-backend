import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import OrderController from './order.controller';
import { tipToBartenderValidation } from './order.validation';

const router = express.Router();

router.post(
  '/create-order',
  auth(USER_ROLE.customer),
  OrderController.createOrder,
);

router.get(
  '/get-my-orders',
  auth(USER_ROLE.customer, USER_ROLE.bartender, USER_ROLE.venueOwner),
  OrderController.getMyOrders,
);
router.get(
  '/get-all-orders',
  auth(USER_ROLE.superAdmin),
  OrderController.getAllOrder,
);
router.get(
  '/get-single-order/:id',
  auth(USER_ROLE.bartender, USER_ROLE.customer, USER_ROLE.venueOwner),
  OrderController.getSingleOrder,
);

router.patch(
  '/mark-as-unavailable/:id',
  auth(USER_ROLE.bartender),
  OrderController.markAsUnavailableAndRefund,
);

router.patch(
  '/update-status/:id',
  auth(USER_ROLE.customer, USER_ROLE.bartender),
  OrderController.changeStatus,
);

router.post(
  '/tip-to-bartender/:id',
  auth(USER_ROLE.customer),
  validateRequest(tipToBartenderValidation),
  OrderController.tipToBartender,
);

export const orderRoutes = router;
