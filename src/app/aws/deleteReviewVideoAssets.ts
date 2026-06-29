/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CancelJobCommand,
  GetJobCommand,
  MediaConvertClient,
} from '@aws-sdk/client-mediaconvert';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const mediaConvert = new MediaConvertClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_MEDIACONVERT_ENDPOINT,
});

export const deleteReviewVideoAssets = async (review: any) => {
  const BUCKET = process.env.AWS_S3_BUCKET_NAME!;

  /* ---------------------------------- */
  /* 1️⃣ Cancel MediaConvert Job (if active) */
  /* ---------------------------------- */
  if (review.jobId) {
    try {
      const job = await mediaConvert.send(
        new GetJobCommand({ Id: review.jobId }),
      );

      const status = job.Job?.Status;

      if (status === 'SUBMITTED' || status === 'PROGRESSING') {
        await mediaConvert.send(new CancelJobCommand({ Id: review.jobId }));
      }
    } catch (err) {
      console.warn('MediaConvert job not found or already finished');
    }
  }

  /* ---------------------------------- */
  /* 2️⃣ Delete RAW video */
  /* ---------------------------------- */
  if (review.rawVideoKey) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: review.rawVideoKey,
      }),
    );
  }

  /* ---------------------------------- */
  /* 3️⃣ Delete ALL HLS files (folder delete) */
  /* ---------------------------------- */
  if (review.videoId) {
    const hlsPrefix = `uploads/videos/review_videos/hls/${review.videoId}/`;

    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: hlsPrefix,
      }),
    );

    if (listed.Contents?.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: listed.Contents.map((obj) => ({
              Key: obj.Key!,
            })),
          },
        }),
      );
    }
  }

  console.log('✅ All video assets deleted successfully');
};
