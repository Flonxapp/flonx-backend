export const getCloudFrontUrl = (s3Url: string) => {
  return s3Url.replace(
    'https://sampli-application.s3.us-east-1.amazonaws.com',
    'http://d3vsrns3ta794s.cloudfront.net',
  );
};
