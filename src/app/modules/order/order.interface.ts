import { Document, Types } from 'mongoose';
import { ENUM_ORDER_STATUS } from './order.enum';

export interface IOrderItem {
  product: Types.ObjectId;
  quantity: number;
  price: number;
}

export interface IOrder extends Document {
  customer: Types.ObjectId;
  venueOwner: Types.ObjectId;
  venue: Types.ObjectId;
  bartender: Types.ObjectId;
  shift: Types.ObjectId;
  items: IOrderItem[];
  totalQuantity: number;
  subTotal: number;
  deliveryFee: number;
  totalPrice: number;
  status: (typeof ENUM_ORDER_STATUS)[keyof typeof ENUM_ORDER_STATUS];
  paymentIntentId?: string;
  tipAmount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  orderCode: string;
  isTransferSent: boolean;
  colorCode?: string;
}
