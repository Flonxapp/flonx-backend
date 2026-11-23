import { Schema, model } from 'mongoose';
import {
  ENUM_ORDER_CANCELLED_BY,
  ENUM_ORDER_STATUS,
  ENUM_REFUND_STATUS,
} from './order.enum';
import { IOrder, IOrderItem } from './order.interface';

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const orderSchema = new Schema<IOrder>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
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
    bartender: {
      type: Schema.Types.ObjectId,
      ref: 'Bartender',
      required: true,
    },
    shift: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (val: IOrderItem[]) => val.length > 0,
        message: 'Order must have at least one item',
      },
    },

    totalQuantity: {
      type: Number,
      required: true,
      min: 1,
    },

    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: Object.values(ENUM_ORDER_STATUS),
      default: ENUM_ORDER_STATUS.QUEUED,
    },
    paymentIntentId: {
      type: String,
      default: null,
    },
    tipAmount: {
      type: Number,
      default: null,
    },
    // tips already credited, so a repeated webhook is ignored
    tipPaymentIntentIds: {
      type: [String],
      default: [],
    },
    orderCode: {
      type: String,
      required: true,
    },
    colorCode: {
      type: String,
      default: null,
    },
    isTransferSent: {
      type: Boolean,
      default: false,
    },
    cancelledBy: {
      type: String,
      enum: Object.values(ENUM_ORDER_CANCELLED_BY),
    },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true, maxlength: 500 },
    refundStatus: {
      type: String,
      enum: Object.values(ENUM_REFUND_STATUS),
    },
    stripeRefundId: { type: String },
    refundedAmount: { type: Number },
    refundAttempts: { type: Number, default: 0 },
    refundError: { type: String },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ customer: 1 });
orderSchema.index({ venue: 1 });
orderSchema.index({ bartender: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ venue: 1, status: 1 });
orderSchema.index({ bartender: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: 1 });
orderSchema.index({ status: 1, refundStatus: 1 });
orderSchema.index({ stripeRefundId: 1 }, { sparse: true });

export const Order = model<IOrder>('Order', orderSchema);
