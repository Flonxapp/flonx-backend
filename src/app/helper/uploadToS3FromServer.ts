/* eslint-disable @typescript-eslint/no-explicit-any */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import fs from 'fs';
import mime from 'mime-types';
import unlinkFile from './unLinkFile';
dotenv.config();

// Create a new S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const uploadToS3FromServer = async (
  filePath: string,
): Promise<string> => {
  const fileContent = fs.readFileSync(filePath);
  const mimeType = mime.lookup(filePath);
  const s3Key = filePath.replace(/\\/g, '/');

  if (!mimeType) {
    throw new Error('Unable to determine MIME type for file');
  }

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: s3Key,
    Body: fileContent,
    ContentType: mimeType,
  });

  try {
    await s3.send(command);
    unlinkFile(filePath);

    // Manually construct S3 object URL (based on standard public S3 format)
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    return fileUrl;
  } catch (error: any) {
    throw new Error(`Error uploading file to S3: ${error.message}`);
  }
};
