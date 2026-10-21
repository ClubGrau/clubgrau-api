import { CreateCustomerPort } from '@modules/customers/application/ports/inbound/create-customer.port';
import {
  CustomerAlreadyExistsError,
  CustomerIndicationInvalidError,
  CustomerIndicationOriginCategoryMismatchError,
  CustomerIndicationOriginEndedError,
  CustomerIndicationOriginNotFoundError,
  CustomerReferrerNotFoundError,
} from '@modules/customers/domain/errors/customer.errors';
import { InvalidEmailError } from '@shared/domain/value-object/email/email.vo';
import { InvalidUniqueEntityIdError } from '@shared/domain/value-object/id/unique-entity-id.vo';
import { InvalidNameError } from '@shared/domain/value-object/name/name.vo';
import { InvalidNifError } from '@shared/domain/value-object/nif/nif.vo';
import { InvalidPhoneFormatError } from '@shared/domain/value-object/phone/phone.vo';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { CreateCustomerRequest } from '../http/create-customer.request';
import { CreateCustomerController } from './create-customer.controller';

const ORIGIN_ID = '507f1f77bcf86cd799439011';

const makeStubs = () => ({
  createCustomerStub: {
    execute: jest.fn().mockResolvedValue({ id: 'valid_customer_id' }),
  } satisfies CreateCustomerPort,
});

const makeSut = (): SutTypes => {
  const { createCustomerStub } = makeStubs();
  const sut = new CreateCustomerController(createCustomerStub);
  return { sut, createCustomerStub };
};

type SutTypes = {
  sut: CreateCustomerController;
  createCustomerStub: CreateCustomerPort;
};

describe('CreateCustomerController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CreateCustomerController);
  });

  it('should return 400 if name is not provided', async () => {
    const { sut, createCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(createCustomerStub, 'execute');
    const request: CreateCustomerRequest = {
      name: '',
      email: 'test@test.com',
    };
    const response = await sut.handle(request);
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('name').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should return 400 if email is not provided', async () => {
    const { sut, createCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(createCustomerStub, 'execute');
    const request: CreateCustomerRequest = {
      name: 'John Doe',
      email: '',
    };
    const response = await sut.handle(request);
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('email').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should call CreateCustomerPort with correct values', async () => {
    const { sut, createCustomerStub } = makeSut();
    const request: CreateCustomerRequest = {
      name: 'John Doe',
      email: 'test@test.com',
      phone: '+351 912 345 678',
      nif: 123456789,
    };
    const createCustomerSpy = jest.spyOn(createCustomerStub, 'execute');
    await sut.handle(request);
    expect(createCustomerSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      phone: '+351 912 345 678',
      nif: 123456789,
      indication: null,
    });
  });

  it('should forward optional phone and nif when provided', async () => {
    const { sut, createCustomerStub } = makeSut();
    const request: CreateCustomerRequest = {
      name: 'John Doe',
      email: 'test@test.com',
      phone: '+33 6 12 34 56 78',
      nif: 200000004,
    };
    const createCustomerSpy = jest.spyOn(createCustomerStub, 'execute');
    await sut.handle(request);
    expect(createCustomerSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      phone: '+33 6 12 34 56 78',
      nif: 200000004,
      indication: null,
    });
  });

  it('should forward indication null and return 201', async () => {
    const { sut, createCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(createCustomerStub, 'execute');
    const request: CreateCustomerRequest = {
      name: 'John Doe',
      email: 'test@test.com',
      indication: null,
    };

    const response = await sut.handle(request);

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      data: { id: 'valid_customer_id' },
    });
    expect(executeSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      phone: undefined,
      nif: undefined,
      indication: null,
    });
  });

  it('should forward only categoryId, originId and referrerCustomerId', async () => {
    const { sut, createCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(createCustomerStub, 'execute');
    const request = {
      name: 'John Doe',
      email: 'test@test.com',
      indication: {
        categoryId: 'canal',
        originId: ORIGIN_ID,
        referrerCustomerId: null,
        extra: 'ignored',
      },
    } as CreateCustomerRequest;

    const response = await sut.handle(request);

    expect(response.statusCode).toBe(201);
    expect(executeSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      phone: undefined,
      nif: undefined,
      indication: {
        categoryId: 'canal',
        originId: ORIGIN_ID,
        referrerCustomerId: null,
      },
    });
    expect(executeSpy.mock.calls[0][0].indication).not.toHaveProperty('extra');
  });

  it('should not forward rank from the body', async () => {
    const { sut, createCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(createCustomerStub, 'execute');

    await sut.handle({
      name: 'John Doe',
      email: 'test@test.com',
      rank: 'GOLD',
    } as CreateCustomerRequest);

    expect(executeSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      phone: undefined,
      nif: undefined,
      indication: null,
    });
    expect(executeSpy.mock.calls[0][0]).not.toHaveProperty('rank');
  });

  it.each([
    ['string', 'instagram'],
    ['number', 1],
    ['array', []],
  ])('should return 400 if indication is a %s', async (_label, indication) => {
    const { sut, createCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(createCustomerStub, 'execute');

    const response = await sut.handle({
      name: 'John Doe',
      email: 'test@test.com',
      indication,
    } as CreateCustomerRequest);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new CustomerIndicationInvalidError().message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['empty object', {}],
    ['origin without category', { originId: ORIGIN_ID }],
  ])(
    'should return 400 if indication is an %s without categoryId',
    async (_label, indication) => {
      const { sut, createCustomerStub } = makeSut();
      const executeSpy = jest.spyOn(createCustomerStub, 'execute');

      const response = await sut.handle({
        name: 'John Doe',
        email: 'test@test.com',
        indication,
      } as CreateCustomerRequest);

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new MissingParamError('indication.categoryId').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['InvalidNameError', new InvalidNameError('Name is required')],
    ['InvalidEmailError', new InvalidEmailError('Email is required')],
    [
      'InvalidPhoneFormatError',
      new InvalidPhoneFormatError('Invalid phone format: empty'),
    ],
    ['InvalidNifError', new InvalidNifError('NIF must have exactly 9 digits')],
    [
      'InvalidUniqueEntityIdError',
      new InvalidUniqueEntityIdError(
        'Invalid id: "x". Expected a 24-character hex string.',
      ),
    ],
    ['CustomerIndicationInvalidError', new CustomerIndicationInvalidError()],
    [
      'CustomerIndicationOriginNotFoundError',
      new CustomerIndicationOriginNotFoundError(),
    ],
    [
      'CustomerIndicationOriginCategoryMismatchError',
      new CustomerIndicationOriginCategoryMismatchError(),
    ],
    [
      'CustomerIndicationOriginEndedError',
      new CustomerIndicationOriginEndedError(),
    ],
    ['CustomerReferrerNotFoundError', new CustomerReferrerNotFoundError()],
  ] as const)('should return 400 if port throws %s', async (_label, error) => {
    const { sut, createCustomerStub } = makeSut();
    jest.spyOn(createCustomerStub, 'execute').mockRejectedValue(error);

    const response = await sut.handle({
      name: 'John Doe',
      email: 'test@test.com',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: error.message });
  });

  it('should return 409 if port throws CustomerAlreadyExistsError', async () => {
    const { sut, createCustomerStub } = makeSut();
    jest
      .spyOn(createCustomerStub, 'execute')
      .mockRejectedValue(new CustomerAlreadyExistsError());

    const response = await sut.handle({
      name: 'John Doe',
      email: 'test@test.com',
    });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: 'Customer already exists',
    });
  });

  it('should return 500 if CreateCustomerPort throws', async () => {
    const { sut, createCustomerStub } = makeSut();
    const request: CreateCustomerRequest = {
      name: 'John Doe',
      email: 'test@test.com',
    };
    const createCustomerSpy = jest
      .spyOn(createCustomerStub, 'execute')
      .mockRejectedValue(new Error('CreateCustomerPort error'));
    const response = await sut.handle(request);
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'CreateCustomerPort error',
    });
    expect(createCustomerSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      phone: undefined,
      nif: undefined,
      indication: null,
    });
  });

  it('should return 201 if customer is created successfully', async () => {
    const { sut } = makeSut();
    const request: CreateCustomerRequest = {
      name: 'John Doe',
      email: 'test@test.com',
    };
    const response = await sut.handle(request);
    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      data: { id: 'valid_customer_id' },
    });
  });
});
