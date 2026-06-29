/* eslint-disable @typescript-eslint/no-explicit-any */
import { PutObjectCommand } from '@aws-sdk/client-s3';
import QRCode from 'qrcode';
import { getCloudFrontUrl, s3 } from '../aws/multer-s3-uploader';
import config from '../config';

export const generateVenueQRCode = async (venueId: string): Promise<string> => {
  try {
    const url = `${config.domain}/venue/${venueId}`;
    const qrBuffer = await QRCode.toBuffer(url, { type: 'png', width: 500 });

    const s3Key = `uploads/venue-qrcodes/${venueId}-${Date.now()}.png`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
        Body: qrBuffer,
        ContentType: 'image/png',
      }),
    );

    const qrCloudFrontUrl = getCloudFrontUrl(s3Key);
    return qrCloudFrontUrl;
  } catch (err: any) {
    console.error('Error generating/uploading QR code:', err.message || err);
    throw new Error('Failed to generate QR code');
  }
};
