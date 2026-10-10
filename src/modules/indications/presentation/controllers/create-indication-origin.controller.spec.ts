import { CreateIndicationOriginPort } from '@modules/indications/application/ports/inbound/create-indication-origin.port';
import {
  IndicationCategoryDoesNotHoldOriginsError,
  IndicationCategoryUnknownError,
  IndicationOriginNameTakenError,
} from '@modules/indications/domain/errors/indication.errors';
import { InvalidNameError } from '@shared/domain/value-object/name/name.vo';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { CreateIndicationOriginRequest } from '../http/create-indication-origin.request';
import { CreateIndicationOriginController } from './create-indication-origin.controller';

const ORIGIN_ID = '507f1f77bcf86cd799439011';

const makeStubs = () => ({
  createIndicationOriginStub: {
    execute: jest.fn().mockResolvedValue({ id: ORIGIN_ID }),
  } satisfies CreateIndicationOriginPort,
});

const makeSut = (): SutTypes => {
  const { createIndicationOriginStub } = makeStubs();
  const sut = new CreateIndicationOriginController(createIndicationOriginStub);
  return { sut, createIndicationOriginStub };
};

type SutTypes = {
  sut: CreateIndicationOriginController;
  createIndicationOriginStub: CreateIndicationOriginPort;
};

describe('CreateIndicationOriginController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CreateIndicationOriginController);
  });

  it('should return 400 if categoryId is not provided', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    const executeSpy = jest.spyOn(createIndicationOriginStub, 'execute');

    const response = await sut.handle({ categoryId: '', name: 'Facebook' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('categoryId').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should return 400 if name is not provided', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    const executeSpy = jest.spyOn(createIndicationOriginStub, 'execute');

    const response = await sut.handle({ categoryId: 'canal', name: '' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('name').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should call the port with categoryId and name only', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    const executeSpy = jest.spyOn(createIndicationOriginStub, 'execute');
    const request = {
      categoryId: 'canal',
      name: 'Facebook',
      position: 9,
    };

    await sut.handle(request);

    expect(executeSpy).toHaveBeenCalledWith({
      categoryId: 'canal',
      name: 'Facebook',
    });
  });

  it('should forward name whitespace and ignore actorId and id', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    const executeSpy = jest.spyOn(createIndicationOriginStub, 'execute');
    const request: CreateIndicationOriginRequest = {
      categoryId: 'canal',
      name: '  Facebook  ',
      id: 'forged',
      actorId: 'actor-1',
    };

    await sut.handle(request);

    expect(executeSpy).toHaveBeenCalledWith({
      categoryId: 'canal',
      name: '  Facebook  ',
    });
  });

  it('should return 400 if the port throws IndicationCategoryUnknownError', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    jest
      .spyOn(createIndicationOriginStub, 'execute')
      .mockRejectedValue(new IndicationCategoryUnknownError());

    const response = await sut.handle({
      categoryId: 'unknown',
      name: 'Facebook',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Indication category is unknown',
    });
  });

  it('should return 400 if the port throws IndicationCategoryDoesNotHoldOriginsError', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    jest
      .spyOn(createIndicationOriginStub, 'execute')
      .mockRejectedValue(new IndicationCategoryDoesNotHoldOriginsError());

    const response = await sut.handle({
      categoryId: 'amigo',
      name: 'Facebook',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Indication category does not hold origins',
    });
  });

  it('should return 400 if the port throws InvalidNameError', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    jest
      .spyOn(createIndicationOriginStub, 'execute')
      .mockRejectedValue(
        new InvalidNameError('Name must be at least 2 characters long'),
      );

    const response = await sut.handle({ categoryId: 'canal', name: ' ' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Name must be at least 2 characters long',
    });
  });

  it('should return 409 if the port throws IndicationOriginNameTakenError', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    jest
      .spyOn(createIndicationOriginStub, 'execute')
      .mockRejectedValue(new IndicationOriginNameTakenError());

    const response = await sut.handle({
      categoryId: 'canal',
      name: 'Facebook',
    });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: 'Indication origin name is already reserved',
    });
  });

  it('should return 500 if the port throws an unexpected error', async () => {
    const { sut, createIndicationOriginStub } = makeSut();
    jest
      .spyOn(createIndicationOriginStub, 'execute')
      .mockRejectedValue(new Error('CreateIndicationOriginPort error'));

    const response = await sut.handle({
      categoryId: 'canal',
      name: 'Facebook',
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'CreateIndicationOriginPort error',
    });
  });

  it('should return 201 if the origin is created', async () => {
    const { sut } = makeSut();

    const response = await sut.handle({
      categoryId: 'canal',
      name: 'Facebook',
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ data: { id: ORIGIN_ID } });
  });
});
