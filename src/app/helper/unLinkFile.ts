import fs from 'fs';
import path from 'path';
import { errorLogger, logger } from '../shared/logger';

const unlinkFile = (filePath: string) => {
  const fullPath = path.join(process.cwd(), filePath);
  // Check if the file exists----
  if (fs.existsSync(fullPath)) {
    // Unlink the file if it exists---------
    fs.unlink(fullPath, (err) => {
      if (err) {
        errorLogger.error(`Error deleting file: ${filePath}`, err);
      } else {
        logger.info(`File deleted: ${filePath}`);
      }
    });
  } else {
    logger.info(`File does not exist`);
  }
};

export default unlinkFile;
