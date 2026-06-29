/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */

import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../../config';
import AppError from '../../error/appError';
import { registrationSuccessEmailBody } from '../../mailTemplate/registerSucessEmail';
import sendEmail from '../../utilities/sendEmail';
import { IBartender } from '../bartender/bartender.interface';
import { Bartender } from '../bartender/bartender.model';
import { ICustomer } from '../Customer/customer.interface';
import { Customer } from '../Customer/customer.model';
import { upsertDevice } from '../device/device.service';
import { ENUM_SHIFT_STATUS } from '../shift/shift.enum';
import { Shift } from '../shift/shift.model';
import SuperAdmin from '../superAdmin/superAdmin.model';
import { IVenue } from '../venue/venue.interface';
import { VenueOwner } from '../venue_owner/venue_owner.model';
import { USER_ROLE } from './user.constant';
import { TUser, TUserRole } from './user.interface';
import { User } from './user.model';
import { createToken } from './user.utils';
const generateVerifyCode = (): number => {
  return Math.floor(1000 + Math.random() * 9000);
};
const createProfileByRole = async (user: any, payload: any, session: any) => {
  const base = {
    email: user.email,
    user: user._id,
    name: payload.name,
    phone: payload?.phone || '',
  };

  if (user.role === USER_ROLE.customer) {
    const [profile] = await Customer.create([base], { session });
    return profile;
  }

  if (user.role === USER_ROLE.bartender) {
    const [profile] = await Bartender.create(
      [
        {
          ...base,
          address: payload?.address || '',
          location: payload?.location || null,
          skills: payload?.skills,
        },
      ],
      { session },
    );
    return profile;
  }

  if (user.role === USER_ROLE.venueOwner) {
    const [profile] = await VenueOwner.create(
      [
        {
          ...base,
          address: payload?.address || '',
        },
      ],
      { session },
    );
    return profile;
  }
};

const updateProfileByRole = async (
  role: string,
  profileId: string,
  payload: any,
  session: any,
) => {
  const updateData = {
    name: payload.name,
    phone: payload?.phone || '',
  };

  if (role === USER_ROLE.customer) {
    await Customer.findByIdAndUpdate(profileId, updateData, { session });
  }

  if (role === USER_ROLE.bartender) {
    await Bartender.findByIdAndUpdate(
      profileId,
      {
        ...updateData,
        address: payload?.address || '',
        location: payload?.location || null,
        skills: payload?.skills,
      },
      { session },
    );
  }

  if (role === USER_ROLE.venueOwner) {
    await VenueOwner.findByIdAndUpdate(
      profileId,
      {
        ...updateData,
        address: payload?.address || '',
      },
      { session },
    );
  }
};
const registerUser = async (
  payload: TUser &
    ICustomer &
    IVenue &
    IBartender & { playerId: string; platform: string },
) => {
  const { email, password, role } = payload;

  if (!email || !password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Email and password is required',
    );
  }

  const existingUser = await User.findOne({ email });

  const verifyCode = generateVerifyCode();
  const codeExpireIn = new Date(Date.now() + 2 * 60000);

  if (existingUser && existingUser.isVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This email already exists');
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let user: any = existingUser;
    let profile: any;

    //  user exists but not verified
    if (existingUser && !existingUser.isVerified) {
      user = await User.findByIdAndUpdate(
        existingUser._id,
        {
          password,
          role,
          verifyCode,
          codeExpireIn,
        },
        { new: true, session },
      );
      const platform = payload?.platform ? payload?.platform : 'android';

      // device register (IMPORTANT)
      if (payload.playerId) {
        await upsertDevice(user.profileId, payload.playerId, platform);
      }

      if (user?.profileId) {
        await updateProfileByRole(user.role, user.profileId, payload, session);
      } else {
        profile = await createProfileByRole(user, payload, session);

        await User.findByIdAndUpdate(
          user._id,
          { profileId: profile._id },
          { session },
        );
      }
    }

    //  new user
    if (!existingUser) {
      const [newUser] = await User.create(
        [
          {
            email,
            password,
            role,
            verifyCode,
            codeExpireIn,
          },
        ],
        { session },
      );

      user = newUser;
      const platform = payload?.platform ? payload?.platform : 'android';

      profile = await createProfileByRole(user, payload, session);

      await User.findByIdAndUpdate(
        user._id,
        { profileId: profile._id },
        { session },
      );
      if (payload.playerId) {
        await upsertDevice(user.profileId, payload.playerId, platform);
      }
    }

    await session.commitTransaction();
    session.endSession();

    sendEmail({
      email,
      subject: 'Activate Your Account',
      html: registrationSuccessEmailBody(payload.name, verifyCode),
    });

    return profile || user;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const verifyCode = async (email: string, verifyCode: number) => {
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (user.codeExpireIn < new Date(Date.now())) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Verify code is expired');
  }
  if (verifyCode !== user.verifyCode) {
    throw new AppError(httpStatus.BAD_REQUEST, "Code doesn't match");
  }
  await User.findOneAndUpdate(
    { email: email },
    { isVerified: true },
    { new: true, runValidators: true },
  );

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
  };
};

const resendVerifyCode = async (email: string) => {
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  const verifyCode = generateVerifyCode();
  const updateUser = await User.findOneAndUpdate(
    { email: email },
    { verifyCode: verifyCode, codeExpireIn: new Date(Date.now() + 5 * 60000) },
    { new: true, runValidators: true },
  );
  if (!updateUser) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Something went wrong . Please again resend the code after a few second',
    );
  }
  sendEmail({
    email: user.email,
    subject: 'Activate Your Account',
    html: registrationSuccessEmailBody('Dear', updateUser.verifyCode),
  });
  return null;
};

const updateUserProfile = async (userData: JwtPayload, payload: any) => {
  let result = null;
  if (userData.role == USER_ROLE.superAdmin) {
    result = await SuperAdmin.findByIdAndUpdate(userData.profileId, payload, {
      new: true,
      runValidators: true,
    });
  } else if (userData.role == USER_ROLE.venueOwner) {
    result = await VenueOwner.findByIdAndUpdate(userData.profileId, payload, {
      new: true,
      runValidators: true,
    });
  } else if (userData.role == USER_ROLE.bartender) {
    result = await Bartender.findByIdAndUpdate(userData.profileId, payload, {
      new: true,
      runValidators: true,
    });
  } else if (userData.role == USER_ROLE.customer) {
    result = await Customer.findByIdAndUpdate(userData.profileId, payload, {
      new: true,
      runValidators: true,
    });
  }

  return result;
};

const roleModelMap: Record<string, any> = {
  [USER_ROLE.superAdmin]: SuperAdmin,
  [USER_ROLE.venueOwner]: VenueOwner,
  [USER_ROLE.bartender]: Bartender,
  [USER_ROLE.customer]: Customer,
};

const getUserProfile = async (userData: JwtPayload) => {
  const Model = roleModelMap[userData.role];

  if (!Model) {
    throw new Error('Invalid role');
  }

  const result = await Model.findById(userData.profileId).populate({
    path: 'user',
    select: 'isBlocked email role',
  });

  return result;
};

const changeUserStatus = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const result = await User.findByIdAndUpdate(
    id,
    { isBlocked: !user.isBlocked },
    { new: true, runValidators: true },
  );
  return result;
};

const deleteAccount = async (userData: JwtPayload, password: string) => {
  const user = await User.findById(userData.id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account not found');
  }

  if (
    !user.password ||
    !(await User.isPasswordMatched(password, user.password))
  ) {
    throw new AppError(httpStatus.FORBIDDEN, 'Password does not match');
  }

  const hasActiveShift = await Shift.exists({
    $or: [
      { venueOwner: userData.profileId },
      { bartender: userData.profileId },
    ],
    status: {
      $in: [ENUM_SHIFT_STATUS.Active, ENUM_SHIFT_STATUS.Upcoming],
    },
  });

  if (
    (userData.role === USER_ROLE.venueOwner ||
      userData.role === USER_ROLE.bartender) &&
    hasActiveShift
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Complete active/upcoming shifts before deleting account',
    );
  }

  const updateUser = User.findByIdAndUpdate(userData.id, {
    isDeleted: true,
    isActive: false,
  });

  let updateProfile;

  switch (userData.role) {
    case USER_ROLE.venueOwner:
      updateProfile = VenueOwner.findByIdAndUpdate(userData.profileId, {
        isDeleted: true,
      });
      break;

    case USER_ROLE.bartender:
      updateProfile = Bartender.findByIdAndUpdate(userData.profileId, {
        isDeleted: true,
      });
      break;

    case USER_ROLE.customer:
      updateProfile = Customer.findByIdAndUpdate(userData.profileId, {
        isDeleted: true,
      });
      break;

    default:
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid user account');
  }

  await Promise.all([updateUser, updateProfile]);

  return null;
};

const userServices = {
  registerUser,
  verifyCode,
  resendVerifyCode,
  changeUserStatus,
  updateUserProfile,
  getUserProfile,
  deleteAccount,
};

export default userServices;
