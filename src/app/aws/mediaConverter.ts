import { CreateJobCommand } from '@aws-sdk/client-mediaconvert';
import mcClient from './mediaConverterClient';

function parseS3Url(url: string) {
  const urlObj = new URL(url);
  const bucket = urlObj.hostname.split('.')[0]; // e.g., sampli-bucket101
  const key = urlObj.pathname.substring(1); // remove leading '/'
  return { bucket, key };
}

export const createHlsJobFromUrl = async ({
  videoUrl,
  videoId,
  roleArn,
  reviewId,
  reviewerId,
  rawFileName,
}: {
  videoUrl: string;
  videoId: string;
  roleArn: string;
  reviewId: string;
  reviewerId: string;
  rawFileName: string;
}) => {
  const { bucket, key } = parseS3Url(videoUrl);

  const command = new CreateJobCommand({
    Role: roleArn,
    UserMetadata: {
      reviewId: reviewId,
      reviewerId: reviewerId,
      videoId: videoId,
      rawFileName,
    },
    Settings: {
      Inputs: [
        {
          FileInput: `s3://${bucket}/${key}`,
          AudioSelectors: {
            'Audio Selector 1': { DefaultSelection: 'DEFAULT' }, // REQUIRED
          },
        },
      ],
      OutputGroups: [
        {
          Name: 'HLS Group',
          OutputGroupSettings: {
            Type: 'HLS_GROUP_SETTINGS',
            HlsGroupSettings: {
              Destination: `s3://${bucket}/uploads/videos/review_videos/hls/${videoId}/`,
              SegmentLength: 6,
              MinSegmentLength: 0, // REQUIRED
              ManifestDurationFormat: 'INTEGER',
            },
          },
          Outputs: [
            {
              NameModifier: '_360p',
              VideoDescription: {
                Width: 640,
                Height: 360,
                CodecSettings: {
                  Codec: 'H_264',
                  H264Settings: { Bitrate: 800000 },
                },
              },
              AudioDescriptions: [
                {
                  AudioSourceName: 'Audio Selector 1', // FIX for AWS SDK v3
                  AudioTypeControl: 'FOLLOW_INPUT', // recommended
                  CodecSettings: {
                    Codec: 'AAC',
                    AacSettings: {
                      Bitrate: 96000,
                      CodingMode: 'CODING_MODE_2_0',
                      SampleRate: 48000,
                    },
                  },
                },
              ],
              ContainerSettings: {
                Container: 'M3U8',
              },
            },
            {
              NameModifier: '_720p',
              VideoDescription: {
                Width: 1280,
                Height: 720,
                CodecSettings: {
                  Codec: 'H_264',
                  H264Settings: { Bitrate: 2500000 },
                },
              },
              AudioDescriptions: [
                {
                  AudioSourceName: 'Audio Selector 1', // FIX
                  AudioTypeControl: 'FOLLOW_INPUT', // recommended
                  CodecSettings: {
                    Codec: 'AAC',
                    AacSettings: {
                      Bitrate: 128000,
                      CodingMode: 'CODING_MODE_2_0',
                      SampleRate: 48000,
                    },
                  },
                },
              ],
              ContainerSettings: {
                Container: 'M3U8',
              },
            },
          ],
        },
      ],
    },
  });

  const response = await mcClient.send(command);
  return response;
};
