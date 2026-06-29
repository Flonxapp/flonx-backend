import { model, Schema } from 'mongoose';
import { ICategory } from './category.interface';

const CategorySchema: Schema = new Schema<ICategory>(
  {
    venueOwner: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'VenueOwner',
    },
    venue: { type: Schema.Types.ObjectId, required: true, ref: 'Venue' },
    name: { type: String, required: true },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Category = model<ICategory>('Category', CategorySchema);

export default Category;
