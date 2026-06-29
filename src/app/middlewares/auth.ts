/* eslint-disable no-unused-vars */
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../config';
import AppError from '../error/appError';
import { TUserRole } from '../modules/user/user.interface';
import { User } from '../modules/user/user.model';
import catchAsync from '../utilities/catchasync';

// make costume interface

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    let token = req?.headers?.authorization;

    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized');
    }

    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }
    let decoded;

    try {
      decoded = jwt.verify(
        token,
        config.jwt_access_secret as string,
      ) as JwtPayload;
    } catch (err) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Token is expired');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, role, iat } = decoded;

    if (!decoded) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Token is expired');
    }
    // get the user if that here ---------
    const user = await User.findById(id).select(
      'isDeleted isBlocked isVerified passwordChangedAt',
    );
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'You are not authorized');
    }
    if (user.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted');
    }
    if (user.isBlocked) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Your account is blocked by admin, please contact support',
      );
    }
    if (!user?.isVerified) {
      throw new AppError(httpStatus.BAD_REQUEST, 'You are not verified user');
    }

    if (user?.passwordChangedAt && iat) {
      const passwordChangeTime =
        new Date(user?.passwordChangedAt).getTime() / 1000;
      if (passwordChangeTime > iat) {
        throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
      }
    }
    if (requiredRoles && !requiredRoles.includes(role)) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Your are not authorized 3');
    }
    // add those properties in req
    req.user = decoded as JwtPayload;
    next();
  });
};

export default auth;
