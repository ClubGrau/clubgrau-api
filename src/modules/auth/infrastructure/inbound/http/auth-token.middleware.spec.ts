import { NextFunction, Request, Response } from 'express';
import { TokenDecoderPort } from '@modules/auth/application/ports/outbound/token-decoder.port';
import { TokenPayload } from '@modules/auth/domain/models/token-payload.model';
import { makeAuthTokenMiddleware } from './auth-token.middleware';

const makeTokenPayload = (): TokenPayload => ({
  id: 'any_id',
  name: 'any_name',
  email: 'any_email@mail.com',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
});

const makeSut = () => {
  const tokenDecoder: TokenDecoderPort<TokenPayload> = {
    decode: jest.fn().mockReturnValue(makeTokenPayload()),
  };
  const sut = makeAuthTokenMiddleware(tokenDecoder);
  const req = {
    headers: {},
  } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;

  return { sut, tokenDecoder, req, res, next };
};

describe('makeAuthTokenMiddleware', () => {
  it('should return 401 if Authorization header is missing', () => {
    const { sut, req, res, next } = makeSut();

    sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token not provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Bearer token is missing', () => {
    const { sut, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer';

    sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token not provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should decode token, attach payload to req and call next', () => {
    const { sut, tokenDecoder, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer any_token';
    const payload = makeTokenPayload();

    sut(req, res, next);

    expect(tokenDecoder.decode).toHaveBeenCalledWith('any_token');
    expect(req.decoded).toEqual(payload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 if decode throws', () => {
    const { sut, tokenDecoder, req, res, next } = makeSut();
    req.headers.authorization = 'Bearer invalid_token';
    jest.spyOn(tokenDecoder, 'decode').mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});
