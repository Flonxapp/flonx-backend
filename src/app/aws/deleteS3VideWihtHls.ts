import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});

// SINGLE SOURCE OF TRUTH
const BUCKET = process.env.AWS_S3_BUCKET_NAME!;

type DeleteS3VideoParams = {
  rawKey?: string; // raw video file key
  hlsPrefix?: string; // hls folder prefix
};

export const deleteS3VideoWithHls = async ({
  rawKey,
  hlsPrefix,
}: DeleteS3VideoParams) => {
  // 1️⃣ Delete raw video
  if (rawKey) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: rawKey,
        }),
      );
      console.log('[S3] Raw video deleted:', rawKey);
    } catch (err) {
      console.error('[S3] Raw video delete failed:', rawKey, err);
    }
  }

  // 2️⃣ Delete ALL HLS files (folder)
  if (hlsPrefix) {
    try {
      const list = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: hlsPrefix,
        }),
      );

      if (!list.Contents?.length) {
        console.log('[S3] No HLS files found:', hlsPrefix);
        return;
      }

      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: list.Contents.map((obj) => ({ Key: obj.Key! })),
            Quiet: true,
          },
        }),
      );

      console.log('[S3] HLS folder deleted:', hlsPrefix);
    } catch (err) {
      console.error('[S3] HLS delete failed:', hlsPrefix, err);
    }
  }
};
