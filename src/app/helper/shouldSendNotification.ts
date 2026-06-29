// import { NotificationSettingField } from '../modules/notification/notification.enum';
// import { NotificationSetting } from '../modules/notificationSetting/notificationSetting.model';

// export const shouldSendNotification = async (
//   type: NotificationSettingField,
//   receiverId: string,
// ) => {
//   if (!receiverId) return false;
//   const settings = await NotificationSetting.findOne({ user: receiverId });
//   if (!settings || !settings.pushNotification) return false;

//   return !!settings[type];
// };

import { NotificationSettingField } from '../modules/notification/notification.enum';
import { NotificationSetting } from '../modules/notificationSetting/notificationSetting.model';

export const shouldSendNotification = async (
  type: NotificationSettingField,
  receiverId: string,
): Promise<boolean> => {
  if (!receiverId) return false;

  const settings = await NotificationSetting.findOne({ user: receiverId });
  if (!settings || !settings.pushNotification) return false;

  // Use type assertion to safely access dynamic key
  return !!(settings as unknown as Record<string, boolean>)[type];
};
