import { MediaConvertClient } from '@aws-sdk/client-mediaconvert';

const mcClient = new MediaConvertClient({
  region: 'us-east-1',
  endpoint: 'https://mediaconvert.us-east-1.amazonaws.com',

  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
export default mcClient;
