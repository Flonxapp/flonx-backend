import bcrypt from 'bcrypt';
import { Schema, model } from 'mongoose';
import config from '../../config';
import { USER_ROLE } from './user.constant';
import { TUser, UserModel } from './user.interface';

const userSchema = new Schema<TUser>(
  {
    profileId: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      sparse: true,
    },
    phone: {
      type: String,
      sparse: true,
    },
    password: {
      type: String,
      // required: true,
    },
    passwordChangedAt: {
      type: Date,
    },
    role: {
      type: String,
      enum: USER_ROLE,
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    verifyCode: {
      type: Number,
    },
    resetCode: {
      type: Number,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isResetVerified: {
      type: Boolean,
      default: false,
    },
    codeExpireIn: {
      type: Date,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    guestSecretHash: {
      type: String,
      select: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      default: '',
    },
    appleId: {
      type: String,
      default: '',
    },
    facebookId: {
      type: String,
      default: '',
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    deviceId: {
      type: String,
      unique: true,
      sparse: true,
    },
    playerIds: { type: [String], default: [] },
  },
  {
    timestamps: true,
  },
);

userSchema.pre('save', async function (next) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const user = this;
  // hash only when the password was set or changed; re-hashing an existing
  // hash on every save would lock the user out
  if (user.isModified('password') && user.password) {
    user.password = await bcrypt.hash(
      user.password,
      Number(config.bcrypt_salt_rounds),
    );
  }
  next();
});

userSchema.post('save', function (doc, next) {
  doc.password = '';
  next();
});
// statics method for check is user exists
userSchema.statics.isUserExists = async function (phone: string) {
  return await User.findOne({ phone }).select('+password');
};
// statics method for check password match  ----
userSchema.statics.isPasswordMatched = async function (
  plainPasswords: string,
  hashPassword: string,
) {
  return await bcrypt.compare(plainPasswords, hashPassword);
};

userSchema.statics.isJWTIssuedBeforePasswordChange = async function (
  passwordChangeTimeStamp,
  jwtIssuedTimeStamp,
) {
  const passwordChangeTime = new Date(passwordChangeTimeStamp).getTime() / 1000;

  return passwordChangeTime > jwtIssuedTimeStamp;
};

// one account per email; guests have no email so they are skipped
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string', $gt: '' } },
  },
);

export const User = model<TUser, UserModel>('User', userSchema);
