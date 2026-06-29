import fs from 'fs';
import path from 'path';

const unlinkFile = (filePath: string) => {
  const fullPath = path.join(process.cwd(), filePath);
  // Check if the file exists----
  if (fs.existsSync(fullPath)) {
    // Unlink the file if it exists---------
    fs.unlink(fullPath, (err) => {
      if (err) {
        console.error(`Error deleting file: ${filePath}`, err);
      } else {
        console.log(`File deleted: ${filePath}`);
      }
    });
  } else {
    console.log(`File does not exist`);
  }
};

export default unlinkFile;
