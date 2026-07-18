import { NextFunction, Request, Response } from 'express';

export const cors = (
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  next();
};
