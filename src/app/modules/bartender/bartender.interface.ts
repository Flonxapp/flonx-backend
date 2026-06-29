import { Types } from 'mongoose';

export interface IBartender {
  user: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  profile_image?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  address: string;
  experience: number;
  bio: string;
  skills?: string[];
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
