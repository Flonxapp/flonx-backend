import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import TransactionController from './transaction.controller';

const router = express.Router();

router.get(
  '/my-transaction',
  auth(USER_ROLE.customer, USER_ROLE.venueOwner),
  TransactionController.getMyTransaction,
);

router.get(
  '/all-transaction',
  auth(USER_ROLE.superAdmin),
  TransactionController.getAllTransaction,
);

router.get(
  '/single/:id',
  auth(USER_ROLE.customer, USER_ROLE.venueOwner, USER_ROLE.superAdmin),
  TransactionController.getSingleTransaction,
);

export const transactionRoutes = router;
