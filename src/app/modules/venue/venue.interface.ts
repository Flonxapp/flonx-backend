import { Types } from 'mongoose';

export interface IVenue {
  venueOwner: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  logo?: string;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  qrCodeUrl?: string;
  isOpen: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
