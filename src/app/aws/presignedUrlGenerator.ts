// with verser 3
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import httpStatus from 'http-status';
import AppError from '../error/appError';

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface GeneratePresignedUrlRequest {
  fileType: string;
  fileCategory: string;
}

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

const CATEGORY_FOLDERS: Record<string, string> = {
  profile_image: 'uploads/images/profile/',
  project_image: 'uploads/images/project_image/',
  project_document: 'uploads/documents/project_document/',
  podcast_cover: 'uploads/documents/podcast_cover/',
  material_image: 'uploads/images/project_material_image/',
  review_video: 'uploads/videos/review_videos/raw/',
};

export const generatePresignedUrl = async ({
  fileType,
  fileCategory,
}: GeneratePresignedUrlRequest) => {
  const extension = ALLOWED_CONTENT_TYPES[fileType];
  if (!extension) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Unsupported file type');
  }

  const folder = CATEGORY_FOLDERS[fileCategory];
  if (!folder) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Unsupported file category');
  }

  const timestamp = Date.now();

  const fileName = `${folder}${timestamp}-${Math.random()
    .toString(36)
    .substring(2, 15)}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: fileName,
    ContentType: fileType,
    // ACL: 'public-read', // You can add this if needed and your bucket allows it
  });

  try {
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 }); // URL valid for 60 seconds
    return { uploadURL, fileName };
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      'Error generating presigned URL',
    );
  }
};

export const generateMultiplePresignedUrls = async (
  files: Array<{ fileType: string; fileCategory: string }>,
) => {
  try {
    const presignedUrls = await Promise.all(
      files.map(async (file) => {
        return await generatePresignedUrl(file);
      }),
    );
    return presignedUrls;
  } catch (err) {
    console.error('Error generating multiple presigned URLs:', err);
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      'Error generating multiple presigned URLs',
    );
  }
};
