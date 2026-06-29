import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import JobApplicationValidations from './job_applicaiton.validation';
import JobApplicationController from './job_application.controller';

const router = express.Router();

router.post(
  '/apply/:jobId',
  auth(USER_ROLE.bartender),
  validateRequest(JobApplicationValidations.applyJobValidationSchema),
  JobApplicationController.applyJob,
);

router.patch(
  '/accept/:id',
  auth(USER_ROLE.customer),
  JobApplicationController.acceptApplication,
);

router.get(
  '/job/:jobId',
  auth(USER_ROLE.customer),
  JobApplicationController.getByJob,
);

router.get('/my', auth(USER_ROLE.bartender), JobApplicationController.getMine);
router.get(
  '/get-single/:id',
  auth(USER_ROLE.bartender, USER_ROLE.customer),
  JobApplicationController.getSingle,
);

router.delete(
  '/cancel-application/:id',
  auth(USER_ROLE.bartender),
  JobApplicationController.cancelApplication,
);
export const jobApplicationRoutes = router;
