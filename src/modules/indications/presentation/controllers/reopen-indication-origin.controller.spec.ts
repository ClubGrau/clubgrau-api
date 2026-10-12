import { ReopenIndicationOriginPort } from '@modules/indications/application/ports/inbound/reopen-indication-origin.port';
import { IndicationOriginNotFoundError } from '@modules/indications/domain/errors/indication.errors';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { ReopenIndicationOriginRequest } from '../http/reopen-indication-origin.request';
import { ReopenIndicationOriginController } from './reopen-indication-origin.controller';

const ORIGIN_ID = '507f1f77bcf86cd799439011';

const makeStubs = () => ({
  reopenIndicationOriginStub: {
    execute: jest.fn().mockResolvedValue({ id: ORIGIN_ID }),
  } satisfies ReopenIndicationOriginPort,
});

const makeSut = (): SutTypes => {
  const { reopenIndicationOriginStub } = makeStubs();
  const sut = new ReopenIndicationOriginController(reopenIndicationOriginStub);
  return { sut, reopenIndicationOriginStub };
};

type SutTypes = {
  sut: ReopenIndicationOriginController;
  reopenIndicationOriginStub: ReopenIndicationOriginPort;
};

describe('ReopenIndicationOriginController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(ReopenIndicationOriginController);
  });

  it('should return 400 if id is not provided', async () => {
    const { sut, reopenIndicationOriginStub } = makeSut();
    const executeSpy = jest.spyOn(reopenIndicationOriginStub, 'execute');

    const response = await sut.handle({ id: '' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('id').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should call the port with id only', async () => {
    const { sut, reopenIndicationOriginStub } = makeSut();
    const executeSpy = jest.spyOn(reopenIndicationOriginStub, 'execute');
    const request: ReopenIndicationOriginRequest = {
      id: ORIGIN_ID,
      actorId: 'actor-1',
    };

    await sut.handle(request);

    expect(executeSpy).toHaveBeenCalledWith({ id: ORIGIN_ID });
  });

  it('should return 400 if the port throws IndicationOriginNotFoundError', async () => {
    const { sut, reopenIndicationOriginStub } = makeSut();
    jest
      .spyOn(reopenIndicationOriginStub, 'execute')
      .mockRejectedValue(new IndicationOriginNotFoundError());

    const response = await sut.handle({ id: ORIGIN_ID });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Indication origin not found' });
  });

  it('should return 500 if the port throws an unexpected error', async () => {
    const { sut, reopenIndicationOriginStub } = makeSut();
    jest
      .spyOn(reopenIndicationOriginStub, 'execute')
      .mockRejectedValue(new Error('ReopenIndicationOriginPort error'));

    const response = await sut.handle({ id: ORIGIN_ID });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'ReopenIndicationOriginPort error',
    });
  });

  it('should return 200 when the origin is reopened, including a no-op', async () => {
    const { sut } = makeSut();

    const response = await sut.handle({ id: ORIGIN_ID });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: { id: ORIGIN_ID } });
  });
});
