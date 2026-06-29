/* eslint-disable @typescript-eslint/no-explicit-any */
import { Shippo } from 'shippo';
import config from '../config';

if (!config.shippo.api_key) {
  throw new Error('Shippo API key is not defined in the configuration.');
}
const shippo = new Shippo({ apiKeyHeader: config.shippo.api_key as string });

export default shippo;
