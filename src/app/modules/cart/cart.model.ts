// cart.model.ts
import { model, Schema } from 'mongoose';
import { ICart } from './cart.interface';

const CartSchema = new Schema<ICart>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Customer',
    },

    venue: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Venue',
    },
    venueOwner: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'VenueOwner',
    },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: 'Product',
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    totalQuantity: {
      type: Number,
      default: 0,
    },
    subTotal: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save middleware to calculate totalQuantity and totalPrice
CartSchema.pre<ICart>('save', function (next) {
  this.totalQuantity = this.items.reduce((acc, item) => acc + item.quantity, 0);
  this.subTotal = this.items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );
  this.deliveryFee = 0;
  this.totalPrice = Number(this.subTotal.toFixed(2));
  next();
});

const Cart = model<ICart>('Cart', CartSchema);
export default Cart;
