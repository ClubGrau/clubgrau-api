import { UpdateCustomerPort } from '@modules/customers/application/ports/inbound/update-customer.port';
import {
  CustomerAlreadyExistsError,
  CustomerAlreadyRemovedError,
  CustomerNotFoundError,
  EmptyCustomerUpdateDataError,
} from '@modules/customers/domain/errors/customer.errors';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidNifError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { UpdateCustomerRequest } from '../http/update-customer.request';
import { UpdateCustomerController } from './update-customer.controller';

const VALID_CUSTOMER_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';

const makeValidRequest = (
  overrides: UpdateCustomerRequest = {},
): UpdateCustomerRequest => ({
  id: VALID_CUSTOMER_ID,
  actorId: ACTOR_ID,
  name: 'Maria Santos',
  ...overrides,
});

const makeStubs = () => ({
  updateCustomerStub: {
    execute: jest.fn().mockResolvedValue({ id: VALID_CUSTOMER_ID }),
  } satisfies UpdateCustomerPort,
});

type SutTypes = {
  sut: UpdateCustomerController;
  updateCustomerStub: UpdateCustomerPort;
};

const makeSut = (): SutTypes => {
  const { updateCustomerStub } = makeStubs();
  const sut = new UpdateCustomerController(updateCustomerStub);
  return { sut, updateCustomerStub };
};

describe('UpdateCustomerController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateCustomerController);
  });

  it('should return 400 if id is not provided and not call port', async () => {
    const { sut, updateCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(updateCustomerStub, 'execute');

    const response = await sut.handle({ id: '', name: 'Maria Santos' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('id').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['empty body', {}],
    ['only ignored rank', { rank: 'GOLD' }],
    [
      'only ignored indication',
      { indication: { categoryId: 'canal', originId: VALID_CUSTOMER_ID } },
    ],
    ['only unknown keys', { foo: 'bar' }],
  ] as const)(
    'should return 400 when request has %s and not call port',
    async (_label, extra) => {
      const { sut, updateCustomerStub } = makeSut();
      const executeSpy = jest.spyOn(updateCustomerStub, 'execute');

      const response = await sut.handle({
        id: VALID_CUSTOMER_ID,
        actorId: ACTOR_ID,
        ...extra,
      } as UpdateCustomerRequest);

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new MissingParamError('no customer fields').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['name', { name: '' }],
    ['name', { name: '   ' }],
    ['name', { name: null }],
    ['name', { name: 123 as unknown as string }],
    ['email', { email: '' }],
    ['email', { email: '   ' }],
    ['email', { email: null }],
    ['email', { email: 123 as unknown as string }],
  ])(
    'should return 400 when required registration field %s is present and blank or non-string',
    async (field, overrides) => {
      const { sut, updateCustomerStub } = makeSut();
      const executeSpy = jest.spyOn(updateCustomerStub, 'execute');

      const response = await sut.handle(makeValidRequest(overrides));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new InvalidParamError(field).message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['phone as number', 'phone', { phone: 912345678 as unknown as string }],
    ['nif as boolean', 'nif', { nif: true as unknown as string }],
    ['nif as NaN', 'nif', { nif: Number.NaN }],
  ])(
    'should return 400 when %s has an invalid primitive type',
    async (_label, field, overrides) => {
      const { sut, updateCustomerStub } = makeSut();
      const executeSpy = jest.spyOn(updateCustomerStub, 'execute');

      const response = await sut.handle(makeValidRequest(overrides));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new InvalidParamError(field).message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it('should forward only the provided field on a partial update', async () => {
    const { sut, updateCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(updateCustomerStub, 'execute');

    const response = await sut.handle({
      id: VALID_CUSTOMER_ID,
      actorId: ACTOR_ID,
      name: 'Maria Santos',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: { id: VALID_CUSTOMER_ID } });
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith({
      id: VALID_CUSTOMER_ID,
      name: 'Maria Santos',
    });
    expect(executeSpy.mock.calls[0]?.[0]).not.toHaveProperty('email');
    expect(executeSpy.mock.calls[0]?.[0]).not.toHaveProperty('phone');
    expect(executeSpy.mock.calls[0]?.[0]).not.toHaveProperty('nif');
  });

  it('should ignore rank, indication, actorId and unknown keys while forwarding valid fields', async () => {
    const { sut, updateCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(updateCustomerStub, 'execute');

    await sut.handle({
      id: VALID_CUSTOMER_ID,
      actorId: ACTOR_ID,
      actorRole: 'EMPLOYEE',
      name: 'Maria Santos',
      email: 'maria.santos@example.com',
      phone: '+351 912 345 678',
      nif: 123456789,
      rank: 'GOLD',
      indication: null,
      extra: 'ignored',
    } as UpdateCustomerRequest);

    expect(executeSpy).toHaveBeenCalledWith({
      id: VALID_CUSTOMER_ID,
      name: 'Maria Santos',
      email: 'maria.santos@example.com',
      phone: '+351 912 345 678',
      nif: '123456789',
    });
    expect(executeSpy.mock.calls[0]?.[0]).not.toHaveProperty('rank');
    expect(executeSpy.mock.calls[0]?.[0]).not.toHaveProperty('indication');
    expect(executeSpy.mock.calls[0]?.[0]).not.toHaveProperty('actorId');
    expect(executeSpy.mock.calls[0]?.[0]).not.toHaveProperty('extra');
  });

  it.each([
    ['null', { phone: null, nif: null }],
    ['empty string', { phone: '', nif: '' }],
    ['whitespace string', { phone: '   ', nif: '   ' }],
  ])(
    'should normalize optional phone and nif %s to null to clear them',
    async (_label, overrides) => {
      const { sut, updateCustomerStub } = makeSut();
      const executeSpy = jest.spyOn(updateCustomerStub, 'execute');

      await sut.handle({
        id: VALID_CUSTOMER_ID,
        ...overrides,
      });

      expect(executeSpy).toHaveBeenCalledWith({
        id: VALID_CUSTOMER_ID,
        phone: null,
        nif: null,
      });
    },
  );

  it('should coerce numeric nif 0 to "0" rather than clearing it', async () => {
    const { sut, updateCustomerStub } = makeSut();
    const executeSpy = jest.spyOn(updateCustomerStub, 'execute');

    await sut.handle({
      id: VALID_CUSTOMER_ID,
      nif: 0,
    });

    expect(executeSpy).toHaveBeenCalledWith({
      id: VALID_CUSTOMER_ID,
      nif: '0',
    });
  });

  it.each([
    [new CustomerAlreadyExistsError(), 'Customer already exists'],
    [new CustomerAlreadyRemovedError(), 'Customer is already removed'],
  ])('should return 409 when port throws %o', async (error, message) => {
    const { sut, updateCustomerStub } = makeSut();
    jest.spyOn(updateCustomerStub, 'execute').mockRejectedValueOnce(error);

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: message });
  });

  it.each([
    [new CustomerNotFoundError(), 'Customer was not found'],
    [
      new EmptyCustomerUpdateDataError(),
      'At least one customer field is required',
    ],
    [new InvalidNameError('Name is required'), 'Name is required'],
    [new InvalidEmailError('Email is required'), 'Email is required'],
    [
      new InvalidPhoneFormatError('Invalid phone format: empty'),
      'Invalid phone format: empty',
    ],
    [
      new InvalidNifError('NIF must have exactly 9 digits'),
      'NIF must have exactly 9 digits',
    ],
  ])('should return 400 when port throws %o', async (error, message) => {
    const { sut, updateCustomerStub } = makeSut();
    jest.spyOn(updateCustomerStub, 'execute').mockRejectedValueOnce(error);

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: message });
  });

  it('should return 500 when port throws an unexpected error', async () => {
    const { sut, updateCustomerStub } = makeSut();
    jest
      .spyOn(updateCustomerStub, 'execute')
      .mockRejectedValueOnce(new Error('UpdateCustomerPort error'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'UpdateCustomerPort error' });
  });
});
