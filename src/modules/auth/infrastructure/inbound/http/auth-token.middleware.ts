import { NextFunction, Request, Response } from 'express';
import { FindAuthenticatableByIdPort } from '@modules/auth/application/ports/outbound/find-authenticatable-by-id.port';
import { TokenDecoderPort } from '@modules/auth/application/ports/outbound/token-decoder.port';
import { TokenPayload } from '@modules/auth/domain/models/token-payload.model';

declare global {
  namespace Express {
    interface Request {
      decoded?: TokenPayload;
    }
  }
}

export type AuthTokenMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

export function makeAuthTokenMiddleware(
  tokenDecoder: TokenDecoderPort<TokenPayload>,
  findAuthenticatableById: FindAuthenticatableByIdPort,
): AuthTokenMiddleware {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { authorization } = req.headers;

    if (!authorization) {
      res.status(401).json({ error: 'Token not provided' });
      return;
    }

    const [, token] = authorization.split(' ');

    if (!token) {
      res.status(401).json({ error: 'Token not provided' });
      return;
    }

    let decoded: TokenPayload;
    try {
      decoded = tokenDecoder.decode(token);
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    let user: Awaited<
      ReturnType<FindAuthenticatableByIdPort['findAuthenticatableById']>
    >;
    try {
      user = await findAuthenticatableById.findAuthenticatableById(decoded.id);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    if ((decoded.sessionVersion ?? 0) !== user.sessionVersion) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    req.decoded = decoded;
    next();
  };
}
