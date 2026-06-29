import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import CustomerController from './customer.controller';

const router = express.Router();
router.get('/get-all', CustomerController.getAllCustomers);
router.get('/get-single/:id', CustomerController.getSingleCustomer);
router.get(
  '/payment-methods',
  auth(USER_ROLE.customer),
  CustomerController.getPaymentMethods,
);
export const customerRoutes = router;
