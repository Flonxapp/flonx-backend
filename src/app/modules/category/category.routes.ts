import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import categoryController from './category.controller';
import categoryValidation from './category.validation';

const router = express.Router();

router.post(
  '/create-category',
  auth(USER_ROLE.venueOwner),
  validateRequest(categoryValidation.createCategoryValidationSchema),
  categoryController.createCategory,
);
router.patch(
  '/update-category/:id',
  auth(USER_ROLE.venueOwner),

  validateRequest(categoryValidation.updateCategoryValidationSchema),
  categoryController.updateCategory,
);

router.get('/all-categories', categoryController.getAllCategories);
router.get('/venue-categories/:id', categoryController.getVenueCategories);
router.get('/get-single-category/:id', categoryController.getSingleCategory);
router.delete(
  '/delete-category/:id',
  auth(USER_ROLE.venueOwner),
  categoryController.deleteCategory,
);

export const categoryRoutes = router;
