import { Device } from './device.model';
export const upsertDevice = async (
  userId: string,
  playerId: string,
  platform?: string,
) => {
  if (!playerId) return;

  return await Device.findOneAndUpdate(
    { userId, playerId },
    {
      userId,
      playerId,
      platform,
      isActive: true,
      lastActiveAt: new Date(),
    },
    { upsert: true, new: true },
  );
};

export const deactivateDevice = async (userId: string, playerId: string) => {
  if (!playerId) return;

  await Device.findOneAndUpdate({ userId, playerId }, { isActive: false });
};
