import { NextFunction, Request, Response } from 'express';
import { FindAuthenticatableByIdPort } from '@modules/auth/application/ports/outbound/find-authenticatable-by-id.port';
import { TokenDecoderPort } from '@modules/auth/application/ports/outbound/token-decoder.port';
import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';
import { TokenPayload } from '@modules/auth/domain/models/token-payload.model';
import { makeAuthTokenMiddleware } from './auth-token.middleware';

const makeTokenPayload = (): TokenPayload => ({
  id: 'any_id',
  name: 'any_name',
  email: 'any_email@mail.com',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  sessionVersion: 0,
});

const makeAuthenticatableUser = (
  overrides: Partial<AuthenticatableUser> = {},
): AuthenticatableUser => ({
  id: 'any_id',
  name: 'any_name',
  email: 'any_email@mail.com',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  passwordHash: 'hashed_password',
  loginCapable: true,
  sessionVersion: 0,
  ...overrides,
});

const makeSut = () => {
  const tokenDecoder: TokenDecoderPort<TokenPayload> = {
    decode: jest.fn().mockReturnValue(makeTokenPayload()),
  };
  const findAuthenticatableById: FindAuthenticatableByIdPort = {
    findAuthenticatableById: jest
      .fn()
      .mockResolvedValue(makeAuthenticatableUser()),
  };
  const sut = makeAuthTokenMiddleware(tokenDecoder, findAuthenticatableById);
  const req = {
    headers: {},
  } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;

  return { sut, tokenDecoder, findAuthenticatableById, req, res, next };
};

describe('makeAuthTokenMiddleware', () => {
  it('should return 401 if Authorization header is missing', async () => {
    const { sut, findAuthenticatableById, req, res, next } = makeSut();

    await sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token not provided' });
    expect(next).not.toHaveBeenCalled();
    expect(
      findAuthenticatableById.findAuthenticatableById,
    ).not.toHaveBeenCalled();
  });

  it('should return 401 if Bearer token is missing', async () => {
    const { sut, findAuthenticatableById, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer';

    await sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token not provided' });
    expect(next).not.toHaveBeenCalled();
    expect(
      findAuthenticatableById.findAuthenticatableById,
    ).not.toHaveBeenCalled();
  });

  it('should return 401 if decode throws and not look up the user', async () => {
    const { sut, tokenDecoder, findAuthenticatableById, req, res, next } =
      makeSut();
    req.headers.authorization = 'Bearer invalid_token';
    jest.spyOn(tokenDecoder, 'decode').mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
    expect(
      findAuthenticatableById.findAuthenticatableById,
    ).not.toHaveBeenCalled();
  });

  it('should call next and attach payload when claim and stored version match (0/0)', async () => {
    const { sut, tokenDecoder, findAuthenticatableById, req, res, next } =
      makeSut();
    req.headers.authorization = 'Bearer any_token';

    await sut(req, res, next);

    expect(tokenDecoder.decode).toHaveBeenCalledWith('any_token');
    expect(
      findAuthenticatableById.findAuthenticatableById,
    ).toHaveBeenCalledWith('any_id');
    expect(req.decoded).toEqual(makeTokenPayload());
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should not attach passwordHash or loginCapable to req.decoded', async () => {
    const { sut, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer any_token';

    await sut(req, res, next);

    expect(req.decoded).not.toHaveProperty('passwordHash');
    expect(req.decoded).not.toHaveProperty('loginCapable');
  });

  it('should treat a missing claim as 0 and call next against stored 0', async () => {
    const { sut, tokenDecoder, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer any_token';
    const legacyPayload: TokenPayload = {
      id: 'any_id',
      name: 'any_name',
      email: 'any_email@mail.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    } as TokenPayload;
    jest.spyOn(tokenDecoder, 'decode').mockReturnValue(legacyPayload);

    await sut(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 when claim 0 mismatches stored 1', async () => {
    const { sut, findAuthenticatableById, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer any_token';
    jest
      .spyOn(findAuthenticatableById, 'findAuthenticatableById')
      .mockResolvedValue(makeAuthenticatableUser({ sessionVersion: 1 }));

    await sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when claim 1 mismatches stored 0', async () => {
    const { sut, tokenDecoder, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer any_token';
    jest
      .spyOn(tokenDecoder, 'decode')
      .mockReturnValue({ ...makeTokenPayload(), sessionVersion: 1 });

    await sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when the user is not found', async () => {
    const { sut, findAuthenticatableById, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer any_token';
    jest
      .spyOn(findAuthenticatableById, 'findAuthenticatableById')
      .mockResolvedValue(null);

    await sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 and fail closed when the adapter rejects', async () => {
    const { sut, findAuthenticatableById, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer any_token';
    jest
      .spyOn(findAuthenticatableById, 'findAuthenticatableById')
      .mockRejectedValue(new Error('driver down'));

    await sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('should authenticate an INACTIVE user with a matching version', async () => {
    const { sut, findAuthenticatableById, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer any_token';
    jest
      .spyOn(findAuthenticatableById, 'findAuthenticatableById')
      .mockResolvedValue(
        makeAuthenticatableUser({ status: 'INACTIVE', loginCapable: false }),
      );

    await sut(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
