import { EndIndicationOriginPort } from '@modules/indications/application/ports/inbound/end-indication-origin.port';
import { IndicationOriginNotFoundError } from '@modules/indications/domain/errors/indication.errors';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { EndIndicationOriginRequest } from '../http/end-indication-origin.request';
import { EndIndicationOriginController } from './end-indication-origin.controller';

const ORIGIN_ID = '507f1f77bcf86cd799439011';

const makeStubs = () => ({
  endIndicationOriginStub: {
    execute: jest.fn().mockResolvedValue({ id: ORIGIN_ID }),
  } satisfies EndIndicationOriginPort,
});

const makeSut = (): SutTypes => {
  const { endIndicationOriginStub } = makeStubs();
  const sut = new EndIndicationOriginController(endIndicationOriginStub);
  return { sut, endIndicationOriginStub };
};

type SutTypes = {
  sut: EndIndicationOriginController;
  endIndicationOriginStub: EndIndicationOriginPort;
};

describe('EndIndicationOriginController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(EndIndicationOriginController);
  });

  it('should return 400 if id is not provided', async () => {
    const { sut, endIndicationOriginStub } = makeSut();
    const executeSpy = jest.spyOn(endIndicationOriginStub, 'execute');

    const response = await sut.handle({ id: '' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('id').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should call the port with id only', async () => {
    const { sut, endIndicationOriginStub } = makeSut();
    const executeSpy = jest.spyOn(endIndicationOriginStub, 'execute');
    const request: EndIndicationOriginRequest = {
      id: ORIGIN_ID,
      actorId: 'actor-1',
    };

    await sut.handle(request);

    expect(executeSpy).toHaveBeenCalledWith({ id: ORIGIN_ID });
  });

  it('should return 400 if the port throws IndicationOriginNotFoundError', async () => {
    const { sut, endIndicationOriginStub } = makeSut();
    jest
      .spyOn(endIndicationOriginStub, 'execute')
      .mockRejectedValue(new IndicationOriginNotFoundError());

    const response = await sut.handle({ id: ORIGIN_ID });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Indication origin not found' });
  });

  it('should return 500 if the port throws an unexpected error', async () => {
    const { sut, endIndicationOriginStub } = makeSut();
    jest
      .spyOn(endIndicationOriginStub, 'execute')
      .mockRejectedValue(new Error('EndIndicationOriginPort error'));

    const response = await sut.handle({ id: ORIGIN_ID });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'EndIndicationOriginPort error' });
  });

  it('should return 200 when the origin is ended, including a no-op', async () => {
    const { sut } = makeSut();

    const response = await sut.handle({ id: ORIGIN_ID });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: { id: ORIGIN_ID } });
  });
});
