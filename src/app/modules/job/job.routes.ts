import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import JobController from './job.controller';
import JobValidations from './job.validation';

const router = express.Router();

router.post(
  '/create',
  auth(USER_ROLE.customer),
  validateRequest(JobValidations.createJobValidationSchema),
  JobController.createJob,
);

router.patch(
  '/update/:id',
  auth(USER_ROLE.customer),
  validateRequest(JobValidations.updateJobValidationSchema),
  JobController.updateJob,
);

router.delete('/delete/:id', auth(USER_ROLE.customer), JobController.deleteJob);
router.get('/get-all', JobController.getAllJobs);
router.get(
  '/get-single/:id',

  auth(
    USER_ROLE.bartender,
    USER_ROLE.customer,
    USER_ROLE.superAdmin,
    USER_ROLE.venueOwner,
  ),
  JobController.getSingleJob,
);
router.get(
  '/my-jobs',
  auth(USER_ROLE.bartender, USER_ROLE.customer),
  JobController.getMyJobs,
);
router.patch(
  '/mark-as-complete/:id',
  auth(USER_ROLE.customer),
  JobController.markAsComplete,
);
router.patch(
  '/cancel/:id',
  auth(USER_ROLE.customer, USER_ROLE.bartender),
  JobController.cancelJob,
);

export const jobRoutes = router;
