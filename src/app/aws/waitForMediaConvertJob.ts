import { GetJobCommand } from '@aws-sdk/client-mediaconvert';
import mcClient from './mediaConverterClient';

export async function waitForJobCompletion(
  jobId: string,
  maxWaitTime = 30000000,
) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const command = new GetJobCommand({ Id: jobId });
    const response = await mcClient.send(command);
    const status = response.Job?.Status;

    console.log(`Job ${jobId} status: ${status}`);

    if (status === 'COMPLETE') {
      console.log('Job completed successfully!');
      return true;
    }

    if (status === 'ERROR' || status === 'CANCELED') {
      throw new Error(
        `Job failed with status: ${status}. Error: ${response.Job?.ErrorMessage}`,
      );
    }

    // Wait 10 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  throw new Error('Job did not complete within the maximum wait time');
}
