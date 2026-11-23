import 'dotenv/config';
import { Server as HTTPServer } from 'http';
import mongoose from 'mongoose';
import server from './app';
import config from './app/config';
import seedSuperAdmin from './app/DB';
import validateEnv from './app/config/validateEnv';
import { startJobs } from './app/jobs';
import { errorLogger, logger } from './app/shared/logger';
import { getIO, initializeSocket } from './app/socket/socket';

let httpServer: HTTPServer | undefined;
let shuttingDown = false;

const shutdown = async (reason: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Shutting down: ${reason}`);

  // force exit if something hangs
  setTimeout(() => process.exit(exitCode || 1), 15000).unref();

  try {
    try {
      getIO().close();
    } catch {
      // socket not started
    }
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    }
    await mongoose.connection.close();
    logger.info('Shutdown complete');
  } catch (error) {
    errorLogger.error('Error during shutdown', error);
  } finally {
    process.exit(exitCode);
  }
};

async function main() {
  validateEnv();
  await mongoose.connect(config.database_url as string);
  logger.info('DB Connected Successfully');

  const port = Number(config.port);
  const host = (config.base_url as string) || '0.0.0.0';
  httpServer = server.listen(port, host, () => {
    logger.info(`Server listening on http://${host}:${port}`);
    seedSuperAdmin().catch((error) =>
      errorLogger.error('Seeding super admin failed', error),
    );
  });
  initializeSocket(httpServer);
  startJobs();
}

process.on('unhandledRejection', (error) => {
  errorLogger.error('Unhandled Rejection', error);
});

// state is unknown after an uncaught exception, so restart cleanly
process.on('uncaughtException', (error) => {
  errorLogger.error('Uncaught Exception', error);
  shutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  errorLogger.error('Failed to start server', err);
  process.exit(1);
});
