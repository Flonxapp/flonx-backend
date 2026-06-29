import { model, Schema } from 'mongoose';
import { IBookmark } from './bookmark.interface';

const bookmarkSchema = new Schema<IBookmark>(
  {
    product: {
      type: Schema.Types.ObjectId,
      default: null,
      ref: 'Product',
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Reviewer',
    },
  },
  {
    timestamps: true,
  },
);

const Bookmark = model('Bookmark', bookmarkSchema);

export default Bookmark;
