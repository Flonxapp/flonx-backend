import mongoose, { Schema } from 'mongoose';
import { IProduct } from './product.interface';

const ProductSchema = new Schema<IProduct>(
  {
    venueOwner: {
      type: Schema.Types.ObjectId,
      ref: 'VenueOwner',
      required: true,
    },
    venue: {
      type: Schema.Types.ObjectId,
      ref: 'Venue',
      required: true,
    },
    name: { type: String },
    description: { type: String },
    category: { type: Schema.Types.ObjectId, ref: 'Category' },
    price: {
      type: Number,
    },
    image: { type: String, default: '' },
    tags: { type: [String] },
    slogan: {
      type: String,
      default: '',
    },
    stock: {
      type: Number,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const Product = mongoose.model<IProduct>('Product', ProductSchema);
export default Product;
