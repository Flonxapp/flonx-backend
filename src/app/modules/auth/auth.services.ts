/* eslint-disable no-unused-vars */
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../../config';
import AppError from '../../error/appError';
import changeEmailVerificationBody from '../../mailTemplate/changeEmailVerificationBody';
import { resetPasswordEmailBody } from '../../mailTemplate/resetPasswordEmailBody';
import sendEmail from '../../utilities/sendEmail';
import { Customer } from '../Customer/customer.model';
import { Device } from '../device/device.model';
import { upsertDevice } from '../device/device.service';
import { USER_ROLE } from '../user/user.constant';
import { ILoginWithGoogle, TUser, TUserRole } from '../user/user.interface';
import { User } from '../user/user.model';
import { createToken, verifyToken } from '../user/user.utils';
import { TLoginUser } from './auth.interface';

const generateVerifyCode = (): number => {
  return Math.floor(1000 + Math.random() * 9000);
};
const loginUserIntoDB = async (payload: TLoginUser) => {
  const user = await User.findOne({ email: payload.email });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (user.googleId || user.facebookId || user.appleId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Please login with ${user.googleId ? 'Google' : user.facebookId ? 'Facebook' : 'Apple'}`,
    );
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }
  if (!user.isVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not verified user . Please verify your email',
    );
  }
  // checking if the password is correct ----
  if (!(await User.isPasswordMatched(payload?.password, user?.password))) {
    throw new AppError(httpStatus.FORBIDDEN, 'Password do not match');
  }

  const platform = payload?.platform ? payload?.platform : 'android';

  if (payload.playerId) {
    upsertDevice(user.profileId, payload.playerId, platform);
  }

  const jwtPayload = {
    id: user?._id,
    profileId: user.profileId,
    email: user?.email,
    role: user?.role as TUserRole,
  };
  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );
  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );
  return {
    accessToken,
    refreshToken,
    role: user.role,
    isGuest: user.isGuest || false,
  };
};

const loginWithGoogle = async (payload: ILoginWithGoogle) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if the user already exists
    const isExistUser = await User.findOne(
      { email: payload.email },
      { isVerified: true },
    ).session(session);

    // If user exists, create JWT and return tokens
    if (isExistUser) {
      const jwtPayload = {
        id: isExistUser._id,
        profileId: isExistUser.profileId,
        email: isExistUser.email,
        role: isExistUser.role as TUserRole,
      };

      const accessToken = createToken(
        jwtPayload,
        config.jwt_access_secret as string,
        config.jwt_access_expires_in as string,
      );
      const refreshToken = createToken(
        jwtPayload,
        config.jwt_refresh_secret as string,
        config.jwt_refresh_expires_in as string,
      );

      await session.commitTransaction();
      session.endSession();
      return { accessToken, refreshToken };
    }

    // If user doesn't exist, create a new user
    const userDataPayload: Partial<TUser> = {
      email: payload.email,
      phone: payload?.phone,
      role: USER_ROLE.customer,
    };

    const createUser = await User.create([userDataPayload], { session });

    const CustomerData = {
      name: payload.name,
      email: payload.email,
      profile_image: payload.profile_image,
      user: createUser[0]._id,
    };

    await Customer.create([CustomerData], {
      session,
    });

    // Create JWT tokens
    const jwtPayload = {
      id: createUser[0]._id,
      profileId: createUser[0].profileId,
      email: createUser[0].email,
      role: createUser[0].role as TUserRole,
    };

    const accessToken = createToken(
      jwtPayload,
      config.jwt_access_secret as string,
      config.jwt_access_expires_in as string,
    );
    const refreshToken = createToken(
      jwtPayload,
      config.jwt_refresh_secret as string,
      config.jwt_refresh_expires_in as string,
    );

    await session.commitTransaction();
    session.endSession();

    return { accessToken, refreshToken };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// change password
const changePasswordIntoDB = async (
  userData: JwtPayload,
  payload: {
    oldPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  },
) => {
  if (payload.newPassword !== payload.confirmNewPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Password and confirm password doesn't match",
    );
  }
  const user = await User.findById(userData.id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  if (!(await User.isPasswordMatched(payload?.oldPassword, user?.password))) {
    throw new AppError(httpStatus.FORBIDDEN, 'Password do not match');
  }
  //hash new password
  const newHashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds),
  );
  await User.findOneAndUpdate(
    {
      _id: userData.id,
      role: userData.role,
    },
    {
      password: newHashedPassword,
      passwordChangedAt: new Date(),
    },
  );
  return null;
};

const refreshToken = async (token: string) => {
  const decoded = verifyToken(token, config.jwt_refresh_secret as string);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { username, email, iat } = decoded;

  const user = await User.findOne({
    $or: [{ email: email }, { username: username }],
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }
  // if (
  //   user?.passwordChangedAt &&
  //   (await User.isJWTIssuedBeforePasswordChange(
  //     user?.passwordChangedAt,
  //     iat as number,
  //   ))
  // ) {
  //   throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  // }
  const jwtPayload = {
    id: user?._id,
    profileId: user?.profileId,
    email: user?.email,
    role: user?.role as TUserRole,
  };
  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );
  return { accessToken };
};

// forgot password
const forgetPassword = async (email: string) => {
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  const resetCode = generateVerifyCode();
  await User.findOneAndUpdate(
    { email: email },
    {
      resetCode: resetCode,
      isResetVerified: false,
      codeExpireIn: new Date(Date.now() + 5 * 60000),
    },
  );

  sendEmail({
    email: user.email,
    subject: 'Reset password code',
    html: resetPasswordEmailBody('Dear', resetCode),
  });

  return null;
};

const verifyResetOtp = async (email: string, resetCode: number) => {
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  if (user.codeExpireIn < new Date(Date.now())) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Reset code is expire');
  }
  if (user.resetCode !== Number(resetCode)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Reset code is invalid');
  }
  await User.findOneAndUpdate(
    { email: email },
    { isResetVerified: true },
    { new: true, runValidators: true },
  );
  return null;
};

// reset password
const resetPassword = async (payload: {
  email: string;
  password: string;
  confirmPassword: string;
}) => {
  if (payload.password !== payload.confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Password and confirm password doesn't match",
    );
  }
  const user = await User.findOne({ email: payload.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (!user.isResetVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You need to verify reset code before reset password',
    );
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  //hash new password
  const newHashedPassword = await bcrypt.hash(
    payload.password,
    Number(config.bcrypt_salt_rounds),
  );
  // update the new password
  await User.findOneAndUpdate(
    {
      email: payload.email,
    },
    {
      password: newHashedPassword,
      isResetVerified: false,
      passwordChangedAt: new Date(),
    },
  );
  const jwtPayload = {
    id: user?._id,
    profileId: user?.profileId,
    email: user?.email,
    role: user?.role as TUserRole,
  };
  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );
  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );

  return { accessToken, refreshToken };
};

const resendResetCode = async (email: string) => {
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  const resetCode = generateVerifyCode();
  await User.findOneAndUpdate(
    { email: email },
    {
      resetCode: resetCode,
      isResetVerified: false,
      codeExpireIn: new Date(Date.now() + 5 * 60000),
    },
  );
  sendEmail({
    email: user.email,
    subject: 'Reset password code',
    html: resetPasswordEmailBody('Dear', resetCode),
  });

  return null;
};

// resend verify code ----------------------
const resendVerifyCode = async (email: string) => {
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }
  const verifyCode = generateVerifyCode();
  await User.findOneAndUpdate(
    { email: email },
    {
      verifyCode: verifyCode,
      isVerified: false,
      codeExpireIn: new Date(Date.now() + 5 * 60000),
    },
  );
  sendEmail({
    email: user.email,
    subject: 'Reset password code',
    html: resetPasswordEmailBody('Dear', verifyCode),
  });

  return null;
};

const changeEmail = async (
  userData: JwtPayload,
  payload: { email: string; password: string },
) => {
  const user = await User.findById(userData.id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (!(await User.isPasswordMatched(payload?.password, user?.password))) {
    throw new AppError(httpStatus.FORBIDDEN, 'Password do not match');
  }

  const code = generateVerifyCode();
  await User.findByIdAndUpdate(userData.id, {
    emailChangeCode: code,
    codeExpireIn: new Date(Date.now() + 2 * 60000),
  });
  sendEmail({
    email: payload.email,
    subject: 'Email Change Verification Code',
    html: changeEmailVerificationBody('Dear', code),
  });
};

const guestAuth = async (
  deviceId: string,
  playerId?: string,
  platform?: string,
) => {
  if (!deviceId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Device ID is required');
  }

  let user = await User.findOne({ deviceId, isGuest: true });

  if (!user) {
    user = await User.create({
      role: 'customer',
      isGuest: true,
      deviceId,
      email: '',
      profileId: null,
      isVerified: true,
    });

    const customer = await Customer.create({
      user: user._id,
      name: 'Guest User',
      isGuest: true,
    });

    // IMPORTANT: link profileId
    user.profileId = customer._id.toString();
    await user.save();
  }

  // ❌ safety check
  if (!user.isGuest) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This device is already registered with a full account',
    );
  }

  if (playerId) {
    await upsertDevice(user.profileId, playerId, platform);
  }

  const jwtPayload = {
    id: user._id.toString(),
    profileId: user.profileId || '',
    email: user.email || '',
    role: user.role as TUserRole,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );

  user.password = '';

  return {
    accessToken,
    refreshToken,
  };
};

const logout = async (userData: JwtPayload, playerId: string) => {
  if (playerId) {
    await Device.findOneAndUpdate(
      {
        userId: userData.profileId,
        playerId,
      },
      {
        isActive: false,
        lastActiveAt: new Date(),
      },
    );
  }

  return null;
};

const authServices = {
  loginUserIntoDB,
  changePasswordIntoDB,
  refreshToken,
  forgetPassword,
  resetPassword,
  verifyResetOtp,
  resendResetCode,
  loginWithGoogle,
  resendVerifyCode,
  changeEmail,
  guestAuth,
  logout,
};

export default authServices;
