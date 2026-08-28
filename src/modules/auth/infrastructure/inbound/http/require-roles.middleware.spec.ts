import { NextFunction, Request, Response } from 'express';
import { makeRequireRoles } from './require-roles.middleware';

const makeSut = (decoded?: { role?: string }) => {
  const sut = makeRequireRoles('ADMIN', 'MANAGER');
  const req = {
    decoded,
  } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;

  return { sut, req, res, next };
};

describe('makeRequireRoles', () => {
  it('should return 403 if token has no role', () => {
    const { sut, req, res, next } = makeSut({});

    sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if role is outside the allowlist', () => {
    const { sut, req, res, next } = makeSut({ role: 'EMPLOYEE' });

    sut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and not touch res when role is allowed', () => {
    const { sut, req, res, next } = makeSut({ role: 'ADMIN' });

    sut(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
