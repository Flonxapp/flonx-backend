import { randomInt } from 'crypto';
import httpStatus from 'http-status';
import AppError from '../error/appError';
import { User } from '../modules/user/user.model';

export const MAX_OTP_ATTEMPTS = 5;

export const generateOtp = (): number => randomInt(100000, 1000000);

type TOtpField = 'verifyCode' | 'resetCode';

// Check a code. A wrong guess counts toward MAX_OTP_ATTEMPTS; after that the
// code is cleared and the user has to request a new one.
export const checkOtp = async (
  user: {
    _id: unknown;
    codeExpireIn?: Date;
    otpAttempts?: number;
    verifyCode?: number;
    resetCode?: number;
  },
  field: TOtpField,
  code: number | string,
) => {
  const stored = user[field];
  if (!stored || (user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This code is no longer valid. Please request a new one.',
    );
  }
  if (!user.codeExpireIn || user.codeExpireIn < new Date()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This code has expired');
  }
  if (Number(code) !== Number(stored)) {
    const updated = await User.findByIdAndUpdate(
      user._id,
      { $inc: { otpAttempts: 1 } },
      { new: true },
    ).select('otpAttempts');
    const left = MAX_OTP_ATTEMPTS - (updated?.otpAttempts || MAX_OTP_ATTEMPTS);
    if (left <= 0) {
      await User.findByIdAndUpdate(user._id, { $unset: { [field]: 1 } });
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Too many wrong attempts. Please request a new code.',
      );
    }
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid code. ${left} attempt(s) left.`,
    );
  }
};
