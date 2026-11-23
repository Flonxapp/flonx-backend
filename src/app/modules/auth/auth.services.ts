/* eslint-disable no-unused-vars */
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../../config';
import AppError from '../../error/appError';
import changeEmailVerificationBody from '../../mailTemplate/changeEmailVerificationBody';
import { resetPasswordEmailBody } from '../../mailTemplate/resetPasswordEmailBody';
import { sendEmailInBackground } from '../../utilities/sendEmail';
import { Customer } from '../Customer/customer.model';
import { Device } from '../device/device.model';
import { upsertDevice } from '../device/device.service';
import { USER_ROLE } from '../user/user.constant';
import { TUserRole } from '../user/user.interface';
import { User } from '../user/user.model';
import { createToken, verifyToken } from '../user/user.utils';
import { Buffer } from 'buffer';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { checkOtp, generateOtp } from '../../utilities/otp';
import { TLoginUser } from './auth.interface';

const generateVerifyCode = generateOtp;
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

// Google sign-in: the client sends the Google ID token it received from
// Google Sign-In; we verify it with Google (signature, expiry, audience)
// and trust only the email inside it. Never trust an email sent in the body.
const googleClient = new OAuth2Client();

const loginWithGoogle = async (payload: { idToken: string }) => {
  if (!config.google_client_ids.length) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      'Google login is not configured',
    );
  }

  let googleUser: TokenPayload | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_ids,
    });
    googleUser = ticket.getPayload();
  } catch {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid Google token');
  }
  if (!googleUser?.email || !googleUser.email_verified) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Google account email is not verified',
    );
  }
  const email = googleUser.email.toLowerCase();

  const issueTokens = (user: {
    _id: unknown;
    profileId?: unknown;
    email?: string;
    role: string;
  }) => {
    const jwtPayload = {
      id: String(user._id),
      profileId: String(user.profileId),
      email: user.email || '',
      role: user.role as TUserRole,
    };
    return {
      accessToken: createToken(
        jwtPayload,
        config.jwt_access_secret as string,
        config.jwt_access_expires_in as string,
      ),
      refreshToken: createToken(
        jwtPayload,
        config.jwt_refresh_secret as string,
        config.jwt_refresh_expires_in as string,
      ),
      role: user.role,
    };
  };

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (existingUser.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
    }
    if (existingUser.isBlocked) {
      throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
    }
    if (existingUser.role === USER_ROLE.superAdmin) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Please login with email and password',
      );
    }
    if (existingUser.googleId && existingUser.googleId !== googleUser.sub) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid Google account');
    }
    if (!existingUser.isVerified) {
      // Google has proven ownership of this email
      existingUser.isVerified = true;
      await existingUser.save();
    }
    return issueTokens(existingUser);
  }

  // New user: create a verified customer account
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const [createdUser] = await User.create(
      [
        {
          email,
          role: USER_ROLE.customer,
          googleId: googleUser.sub,
          isVerified: true,
        },
      ],
      { session },
    );
    const [customer] = await Customer.create(
      [
        {
          name: googleUser.name || email.split('@')[0],
          email,
          profile_image: googleUser.picture,
          user: createdUser._id,
        },
      ],
      { session },
    );
    createdUser.profileId = customer._id as never;
    await createdUser.save({ session });
    await session.commitTransaction();
    return issueTokens(createdUser);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
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

const refreshToken = async (token: string | undefined) => {
  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Refresh token is required');
  }
  let decoded;
  try {
    decoded = verifyToken(token, config.jwt_refresh_secret as string);
  } catch {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
  }
  const { id, iat } = decoded;

  // look up by id: guests all share an empty email
  const user = id ? await User.findById(id) : null;
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
  }
  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }
  if (
    user.passwordChangedAt &&
    iat &&
    (await User.isJWTIssuedBeforePasswordChange(user.passwordChangedAt, iat))
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Please login again');
  }
  const jwtPayload = {
    id: user._id,
    profileId: user.profileId,
    email: user.email,
    role: user.role as TUserRole,
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
      otpAttempts: 0,
    },
  );

  sendEmailInBackground({
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

  await checkOtp(user, 'resetCode', resetCode);
  await User.findOneAndUpdate(
    { email: email },
    { isResetVerified: true, otpAttempts: 0, $unset: { resetCode: 1 } },
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
      otpAttempts: 0,
    },
  );
  sendEmailInBackground({
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
      otpAttempts: 0,
    },
  );
  sendEmailInBackground({
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
    otpAttempts: 0,
  });
  sendEmailInBackground({
    email: payload.email,
    subject: 'Email Change Verification Code',
    html: changeEmailVerificationBody('Dear', code),
  });
};

const hashGuestSecret = (secret: string) =>
  createHash('sha256').update(secret).digest('hex');

// The device id alone is not proof of identity. The first login returns a
// random guestSecret; later logins for that device must send it back.
const guestAuth = async (
  deviceId: string,
  playerId?: string,
  platform?: string,
  guestSecret?: string,
) => {
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 200) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Device ID is required');
  }

  let user = await User.findOne({ deviceId }).select('+guestSecretHash');
  let newSecret: string | undefined;

  if (user && user.guestSecretHash) {
    const given = guestSecret ? hashGuestSecret(String(guestSecret)) : '';
    const expected = user.guestSecretHash;
    if (
      given.length !== expected.length ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid guest session');
    }
  } else if (user && config.guest_secret_enforced && user.isGuest) {
    // guest created before secrets existed: issue one now
    newSecret = randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      { guestSecretHash: hashGuestSecret(newSecret) },
    );
  }

  if (!user) {
    newSecret = randomBytes(32).toString('hex');
    user = await User.create({
      role: 'customer',
      isGuest: true,
      deviceId,
      email: '',
      profileId: null,
      isVerified: true,
      guestSecretHash: hashGuestSecret(newSecret),
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

  return {
    accessToken,
    refreshToken,
    // only returned when issued; the client must store it
    ...(newSecret ? { guestSecret: newSecret } : {}),
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
