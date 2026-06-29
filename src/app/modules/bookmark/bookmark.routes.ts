import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import BookmarkController from './bookmark.controller';

const router = express.Router();
router.post(
  '/add-delete-bookmark/:id',
  auth(USER_ROLE.customer),
  BookmarkController.bookmarkAddDelete,
);
router.get(
  '/my-bookmarks',
  auth(USER_ROLE.customer),
  BookmarkController.getMyBookmark,
);

export const bookmarkRoutes = router;
