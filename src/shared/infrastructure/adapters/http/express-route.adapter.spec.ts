import { Request, Response } from 'express';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { adaptRoute } from './express-route.adapter';

type FakeRequest = {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  decoded?: { id?: unknown };
};

const makeFakeReq = (overrides: FakeRequest = {}): Request =>
  ({
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  }) as unknown as Request;

const makeFakeRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return res as unknown as Response & typeof res;
};

const makeController = () => {
  const handle = jest.fn().mockResolvedValue({
    statusCode: 200,
    body: { data: { ok: true } },
  });
  const controller = { handle } as unknown as BaseController<
    Record<string, unknown>,
    { data: { ok: true } }
  >;
  return { controller, handle };
};

describe('adaptRoute', () => {
  it('should be defined', () => {
    const { controller } = makeController();
    const sut = adaptRoute(controller);
    expect(sut).toBeDefined();
    expect(typeof sut).toBe('function');
  });

  it('should forward body, params, query and headers to handle', async () => {
    const { controller, handle } = makeController();
    const sut = adaptRoute(controller);
    const req = makeFakeReq({
      body: { name: 'John' },
      params: { id: '1' },
      query: { page: '2' },
      headers: { 'x-request-id': 'abc' },
    });
    const res = makeFakeRes();

    await sut(req, res);

    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John',
        id: '1',
        page: '2',
        'x-request-id': 'abc',
      }),
    );
  });

  it('should stamp actorId from req.decoded.id', async () => {
    const { controller, handle } = makeController();
    const sut = adaptRoute(controller);
    const req = makeFakeReq({ decoded: { id: 'jwt-actor' } });
    const res = makeFakeRes();

    await sut(req, res);

    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'jwt-actor' }),
    );
  });

  it('should overwrite body actorId with req.decoded.id', async () => {
    const { controller, handle } = makeController();
    const sut = adaptRoute(controller);
    const req = makeFakeReq({
      body: { actorId: 'forged' },
      decoded: { id: 'jwt-actor' },
    });
    const res = makeFakeRes();

    await sut(req, res);

    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'jwt-actor' }),
    );
  });

  it('should coerce decoded.id with String()', async () => {
    const { controller, handle } = makeController();
    const sut = adaptRoute(controller);
    const req = makeFakeReq({ decoded: { id: 12345 } });
    const res = makeFakeRes();

    await sut(req, res);

    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: '12345' }),
    );
  });

  it('should omit actorId when req.decoded is missing', async () => {
    const { controller, handle } = makeController();
    const sut = adaptRoute(controller);
    const req = makeFakeReq();
    const res = makeFakeRes();

    await sut(req, res);

    const [request] = handle.mock.calls[0];
    expect(request).not.toHaveProperty('actorId');
  });

  it('should omit actorId when req.decoded.id is missing', async () => {
    const { controller, handle } = makeController();
    const sut = adaptRoute(controller);
    const req = makeFakeReq({ decoded: {} });
    const res = makeFakeRes();

    await sut(req, res);

    const [request] = handle.mock.calls[0];
    expect(request).not.toHaveProperty('actorId');
  });

  it('should write the controller HttpResponse status and body', async () => {
    const { controller } = makeController();
    const sut = adaptRoute(controller);
    const req = makeFakeReq();
    const res = makeFakeRes();

    await sut(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { ok: true } });
  });
});
