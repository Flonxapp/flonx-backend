import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { bartenderRoutes } from '../modules/bartender/bartender.routes';
import { cartRoutes } from '../modules/cart/cart.routes';
import { categoryRoutes } from '../modules/category/category.routes';
import { customerRoutes } from '../modules/Customer/customer.routes';
import { jobRoutes } from '../modules/job/job.routes';
import { jobApplicationRoutes } from '../modules/job_application/job_application.routes';
import { legalInfoRoutes } from '../modules/legal_info/legal_info.routes';
import { ManageRoutes } from '../modules/manage-web/manage.routes';
import { metaRoutes } from '../modules/meta/meta.routes';
import { notificationRoutes } from '../modules/notification/notification.routes';
import { orderRoutes } from '../modules/order/order.routes';
import { productRoutes } from '../modules/product/product.routes';
import { ratingRoutes } from '../modules/rating/rating.routes';
import { shiftRoutes } from '../modules/shift/shift.routes';
import { shiftRatingRoutes } from '../modules/shift_rating/shift_rating.routes';
import { stripeRoutes } from '../modules/stripe/stripe.routes';
import { supportRoutes } from '../modules/support/support.routes';
import { userRoutes } from '../modules/user/user.routes';
import { venueRoutes } from '../modules/venue/venue.routes';
import { venueOwnerRoutes } from '../modules/venue_owner/venue_owner.routes';

const router = Router();

const moduleRoutes = [
  {
    path: '/auth',
    router: authRoutes,
  },
  {
    path: '/user',
    router: userRoutes,
  },
  {
    path: '/category',
    router: categoryRoutes,
  },
  {
    path: '/product',
    router: productRoutes,
  },
  {
    path: '/venue',
    router: venueRoutes,
  },

  {
    path: '/manage',
    router: ManageRoutes,
  },
  {
    path: '/job',
    router: jobRoutes,
  },
  {
    path: '/job-application',
    router: jobApplicationRoutes,
  },
  {
    path: '/stripe',
    router: stripeRoutes,
  },
  {
    path: '/cart',
    router: cartRoutes,
  },
  {
    path: '/rating',
    router: ratingRoutes,
  },
  {
    path: '/bartender',
    router: bartenderRoutes,
  },
  {
    path: '/shift',
    router: shiftRoutes,
  },
  {
    path: '/order',
    router: orderRoutes,
  },
  {
    path: '/customer',
    router: customerRoutes,
  },
  {
    path: '/meta',
    router: metaRoutes,
  },
  {
    path: '/venue-owner',
    router: venueOwnerRoutes,
  },
  {
    path: '/legal-info',
    router: legalInfoRoutes,
  },
  {
    path: '/support',
    router: supportRoutes,
  },
  {
    path: '/notification',
    router: notificationRoutes,
  },
  {
    path: '/shift-rating',
    router: shiftRatingRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.router));

export default router;
