import { NextFunction, Request, Response } from 'express';

export type RequireRolesMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

export function makeRequireRoles(
  ...allowedRoles: string[]
): RequireRolesMiddleware {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.decoded?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
