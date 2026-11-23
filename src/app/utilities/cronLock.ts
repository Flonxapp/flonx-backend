import { hostname } from 'os';
import mongoose from 'mongoose';
import { errorLogger } from '../shared/logger';

const owner = `${hostname()}:${process.pid}`;

const locks = () =>
  mongoose.connection.collection<{
    _id: string;
    lockedUntil: Date;
    owner: string;
  }>('cron_locks');

// Run a cron job on one server only. The lock expires after ttlMs, so a
// crashed server can't block the job forever.
export const runExclusive = async (
  name: string,
  ttlMs: number,
  job: () => Promise<void>,
) => {
  if (mongoose.connection.readyState !== 1) return;

  const now = new Date();
  try {
    await locks().findOneAndUpdate(
      { _id: name, lockedUntil: { $lte: now } },
      { $set: { lockedUntil: new Date(now.getTime() + ttlMs), owner } },
      { upsert: true },
    );
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) return; // another server holds the lock
    errorLogger.error(`Cron lock error (${name})`, error);
    return;
  }

  try {
    await job();
  } catch (error) {
    errorLogger.error(`Cron job failed (${name})`, error);
  } finally {
    await locks()
      .updateOne({ _id: name, owner }, { $set: { lockedUntil: new Date(0) } })
      .catch(() => undefined);
  }
};
