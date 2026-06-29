import { Types } from 'mongoose';

export interface IBookmark {
  product: Types.ObjectId;
  reviewer: Types.ObjectId;
}
