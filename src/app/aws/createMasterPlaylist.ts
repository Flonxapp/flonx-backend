// import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// const s3 = new S3Client({
//   region: 'us-west-2',
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// });

// export async function createMasterPlaylist(bucket: string, videoId: string) {
//   // Match the filenames that MediaConvert actually outputs
//   const masterPlaylist = `#EXTM3U
// #EXT-X-VERSION:3

// #EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
// ${videoId}_360p.m3u8

// #EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
// ${videoId}_720p.m3u8
// `;

//   await s3.send(
//     new PutObjectCommand({
//       Bucket: bucket,
//       Key: `uploads/videos/review_videos/hls/${videoId}/master.m3u8`,
//       Body: masterPlaylist,
//       ContentType: 'application/vnd.apple.mpegurl',
//     }),
//   );
// }

import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function createMasterPlaylist(bucket: string, videoId: string) {
  const listCommand = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `uploads/videos/review_videos/hls/${videoId}/`,
  });

  const listResponse = await s3.send(listCommand);

  // Find the .m3u8 files (not .ts files)
  const m3u8Files =
    listResponse.Contents?.filter((obj) => obj.Key?.endsWith('.m3u8')).map(
      (obj) => obj.Key?.split('/').pop(),
    ) || [];

  const file360p = m3u8Files.find((f) => f?.includes('360p'));
  const file720p = m3u8Files.find((f) => f?.includes('720p'));

  if (!file360p || !file720p) {
    throw new Error(
      `Could not find variant playlists. Found: ${m3u8Files.join(', ')}`,
    );
  }

  // Create master playlist with correct file references
  const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
${file360p}

#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
${file720p}
`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `uploads/videos/review_videos/hls/${videoId}/master.m3u8`,
      Body: masterPlaylist,
      ContentType: 'application/vnd.apple.mpegurl',
    }),
  );
}
