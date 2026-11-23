import mongoose from 'mongoose';
import config from '../config';
import SuperAdmin from '../modules/superAdmin/superAdmin.model';
import { USER_ROLE } from '../modules/user/user.constant';
import { User } from '../modules/user/user.model';
import { logger } from '../shared/logger';

const superAdminData = {
  username: 'mradmin',
  name: 'Mr Admin',
  email: config.super_admin_email,
};

const seedSuperAdmin = async () => {
  // check when database is connected , we will check is there any user who is super admin
  const superAdminExits = await User.findOne({ role: USER_ROLE.superAdmin });
  if (superAdminExits) {
    logger.info('Admin already exits');
    return;
  }
  // never create an admin without credentials or with a weak password
  if (
    !config.super_admin_email ||
    !config.super_admin_password ||
    config.super_admin_password.length < 12
  ) {
    logger.warn(
      'Super admin not created: set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (12+ characters)',
    );
    return;
  }
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userDataPayload = {
      username: 'mradmin',
      email: config.super_admin_email,
      password: config.super_admin_password,
      role: USER_ROLE.superAdmin,
      isVerified: true,
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const user = await User.create([userDataPayload], { session });

    const superAdminPayload = {
      ...superAdminData,
      user: user[0]._id,
    };
    const result = await SuperAdmin.create([superAdminPayload], { session });
    await User.findByIdAndUpdate(
      user[0]._id,
      { profileId: result[0]._id },
      { session },
    );
    await session.commitTransaction();
    session.endSession();
    logger.info('Super Admin Created Successfully');
    return result[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export default seedSuperAdmin;
