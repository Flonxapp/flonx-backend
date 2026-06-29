/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../config';

const simpleAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return next(); // Continue if no token is provided
    }

    let decoded: JwtPayload | null = null;

    try {
      // Verify token to check validity
      decoded = jwt.verify(
        token,
        config.jwt_access_secret as string,
      ) as JwtPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        decoded = jwt.decode(token) as JwtPayload | null;
      } else {
        return next();
      }
    }

    if (decoded) {
      req.user = decoded;
    }

    next(); // Proceed to the next middleware
  } catch (error) {
    console.log(error);
    next(); // Ignore errors and proceed
  }
};

export default simpleAuth;
