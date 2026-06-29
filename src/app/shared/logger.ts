/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
const { combine, timestamp, label, printf } = format;

// Custom log

const myFormat = printf(({ level, message, label, timestamp, stack }) => {
  if (typeof message === 'object') {
    return `${timestamp} [${label}] ${level}: ${JSON.stringify(message, null, 2)}`;
  }

  return `${timestamp} [${label}] ${level}: ${stack || message}`;
});

const logDir = path.join(process.cwd(), 'logs', 'winston');

export const logger = createLogger({
  level: 'info',
  format: combine(label({ label: 'Simpli Backend' }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new transports.File({
      level: 'info',
      filename: path.join(logDir, 'successes', 'um-success.log'),
    }),

    new DailyRotateFile({
      level: 'info',
      filename: path.join(logDir, 'successes', 'um-%DATE%-success.log'),
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

export const errorLogger = createLogger({
  level: 'error',
  format: combine(label({ label: 'Simpli Backend' }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      level: 'error',
      filename: path.join(logDir, 'errors', 'um-%DATE%-error.log'),
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});
