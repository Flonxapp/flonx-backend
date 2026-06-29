import { Types } from 'mongoose';

export interface IProduct {
  venueOwner: Types.ObjectId;
  venue: Types.ObjectId;
  name: string;
  description: string;
  category: Types.ObjectId;
  price: number;
  image: string;
  tags?: string[];
  isAvailable: boolean;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  stock: number;
  slogan?: string;
}
