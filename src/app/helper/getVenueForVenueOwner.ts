import { Venue } from '../modules/venue/venue.model';

const getVenueIdForVenueOwner = async (id: string) => {
  const result = await Venue.findOne({ venueOwner: id }).select('_id');
  return result?._id;
};

export default getVenueIdForVenueOwner;
