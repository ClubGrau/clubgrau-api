import { CorrectIndicationOriginNamePort } from '@modules/indications/application/ports/inbound/correct-indication-origin-name.port';
import {
  IndicationOriginNameTakenError,
  IndicationOriginNotFoundError,
} from '@modules/indications/domain/errors/indication.errors';
import { InvalidNameError } from '@shared/domain/value-object/name/name.vo';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { CorrectIndicationOriginNameRequest } from '../http/correct-indication-origin-name.request';
import { CorrectIndicationOriginNameController } from './correct-indication-origin-name.controller';

const ORIGIN_ID = '507f1f77bcf86cd799439011';

const makeStubs = () => ({
  correctIndicationOriginNameStub: {
    execute: jest.fn().mockResolvedValue({ id: ORIGIN_ID }),
  } satisfies CorrectIndicationOriginNamePort,
});

const makeSut = (): SutTypes => {
  const { correctIndicationOriginNameStub } = makeStubs();
  const sut = new CorrectIndicationOriginNameController(
    correctIndicationOriginNameStub,
  );
  return { sut, correctIndicationOriginNameStub };
};

type SutTypes = {
  sut: CorrectIndicationOriginNameController;
  correctIndicationOriginNameStub: CorrectIndicationOriginNamePort;
};

describe('CorrectIndicationOriginNameController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CorrectIndicationOriginNameController);
  });

  it('should return 400 if name is not provided', async () => {
    const { sut, correctIndicationOriginNameStub } = makeSut();
    const executeSpy = jest.spyOn(correctIndicationOriginNameStub, 'execute');

    const response = await sut.handle({ id: ORIGIN_ID, name: '' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('name').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should return 400 if id is not provided', async () => {
    const { sut, correctIndicationOriginNameStub } = makeSut();
    const executeSpy = jest.spyOn(correctIndicationOriginNameStub, 'execute');

    const response = await sut.handle({ id: '', name: 'Instagram Ads' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('id').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should call the port with the given id and name only', async () => {
    const { sut, correctIndicationOriginNameStub } = makeSut();
    const executeSpy = jest.spyOn(correctIndicationOriginNameStub, 'execute');
    const request: CorrectIndicationOriginNameRequest & { position: number } = {
      name: 'Instagram Ads',
      id: 'forged',
      actorId: 'actor-1',
      position: 9,
    };

    await sut.handle(request);

    expect(executeSpy).toHaveBeenCalledWith({
      id: 'forged',
      name: 'Instagram Ads',
    });
  });

  it('should return 400 if the port throws IndicationOriginNotFoundError', async () => {
    const { sut, correctIndicationOriginNameStub } = makeSut();
    jest
      .spyOn(correctIndicationOriginNameStub, 'execute')
      .mockRejectedValue(new IndicationOriginNotFoundError());

    const response = await sut.handle({
      id: ORIGIN_ID,
      name: 'Instagram Ads',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Indication origin not found' });
  });

  it('should return 400 if the port throws InvalidNameError', async () => {
    const { sut, correctIndicationOriginNameStub } = makeSut();
    jest
      .spyOn(correctIndicationOriginNameStub, 'execute')
      .mockRejectedValue(
        new InvalidNameError('Name must be at least 2 characters long'),
      );

    const response = await sut.handle({ id: ORIGIN_ID, name: ' ' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Name must be at least 2 characters long',
    });
  });

  it('should return 409 if the port throws IndicationOriginNameTakenError', async () => {
    const { sut, correctIndicationOriginNameStub } = makeSut();
    jest
      .spyOn(correctIndicationOriginNameStub, 'execute')
      .mockRejectedValue(new IndicationOriginNameTakenError());

    const response = await sut.handle({
      id: ORIGIN_ID,
      name: 'Instagram Ads',
    });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: 'Indication origin name is already reserved',
    });
  });

  it('should return 200 when the name is corrected, including a no-op', async () => {
    const { sut } = makeSut();

    const response = await sut.handle({
      id: ORIGIN_ID,
      name: 'Instagram Ads',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: { id: ORIGIN_ID } });
  });
});
