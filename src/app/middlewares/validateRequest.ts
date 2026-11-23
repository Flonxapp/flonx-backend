import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';
import catchAsync from '../utilities/catchasync';

const validateRequest = (schema: AnyZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // if everything is alright next()=>
    await schema.parseAsync({
      body: req.body,
      cookies: req.cookies,
      query: req.query,
      params: req.params,
    });
    return next();
  });
};

export default validateRequest;
