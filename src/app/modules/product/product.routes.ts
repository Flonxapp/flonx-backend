import express, { NextFunction, Request, Response } from 'express';
import { uploadFile } from '../../aws/multer-s3-uploader';
import auth from '../../middlewares/auth';
import parseJsonBody from '../../middlewares/parseJsonBody';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import ProductController from './product.controller';
import ProductValidations from './product.validation';
const router = express.Router();

router.post(
  '/create-product',
  auth(USER_ROLE.venueOwner),
  uploadFile(),
  parseJsonBody(),
  validateRequest(ProductValidations.createProductValidationSchema),
  ProductController.createProduct,
);

router.delete(
  '/delete-product/:id',
  auth(USER_ROLE.venueOwner),
  ProductController.deleteSingleProduct,
);

router.patch(
  '/change-status/:id',
  auth(USER_ROLE.venueOwner),
  ProductController.changeProductStatus,
);
router.get('/venue-products/:id', ProductController.getVenueProducts);
router.get('/single-product/:id', ProductController.getSingleProduct);

router.patch(
  '/update-product/:id',
  auth(USER_ROLE.venueOwner),
  uploadFile(),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(ProductValidations.updateProductValidationSchema),
  ProductController.updateProduct,
);
export const productRoutes = router;
