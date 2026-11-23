/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { errorLogger, logger } from '../shared/logger';
dotenv.config();

// Initialize the S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const deleteFileFromS3 = async (fileName: string) => {
  const updatedFileName = fileName.split('cloudfront.net/')[1];
  const decodedFileName = decodeURIComponent(updatedFileName);
  const bucket = process.env.AWS_S3_BUCKET_NAME!;

  try {
    const headCommand = new HeadObjectCommand({
      Bucket: bucket,
      Key: decodedFileName,
    });

    try {
      await s3.send(headCommand);
    } catch (err: any) {
      if (err.name === 'NotFound') {
        logger.info(`File ${decodedFileName} does not exist in S3.`);
        return;
      }
      throw err;
    }

    // 2. Delete the file
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: decodedFileName,
    });

    await s3.send(deleteCommand);
    logger.info(`Successfully deleted ${decodedFileName} from S3`);
  } catch (err: any) {
    if (err.name === 'NotFound') {
      errorLogger.error(`File ${decodedFileName} was not found in S3.`);
    } else {
      errorLogger.error('Error deleting file from S3:', err);
    }
  }
};
