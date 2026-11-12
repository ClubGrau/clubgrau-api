import { RemoveCustomerPort } from '@modules/customers/application/ports/inbound/remove-customer.port';
import {
  CustomerActorAuthenticationFailedError,
  CustomerAlreadyRemovedError,
  CustomerNotFoundError,
} from '@modules/customers/domain/errors/customer.errors';
import { RemoveCustomerRequest } from '@modules/customers/presentation/http/remove-customer.request';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { RemoveCustomerController } from './remove-customer.controller';

const VALID_CUSTOMER_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';
const ACTOR_PASSWORD = 'P@ssword123';

const makeValidRequest = (
  overrides: RemoveCustomerRequest = {},
): RemoveCustomerRequest => ({
  id: VALID_CUSTOMER_ID,
  password: ACTOR_PASSWORD,
  actorId: ACTOR_ID,
  ...overrides,
});

const makeStubs = () => ({
  removeCustomerStub: {
    execute: jest.fn().mockResolvedValue({ id: VALID_CUSTOMER_ID }),
  } satisfies RemoveCustomerPort,
});

const makeSut = (): SutTypes => {
  const { removeCustomerStub } = makeStubs();
  const sut = new RemoveCustomerController(removeCustomerStub);
  return { sut, removeCustomerStub };
};

type SutTypes = {
  sut: RemoveCustomerController;
  removeCustomerStub: RemoveCustomerPort;
};

describe('RemoveCustomerController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(RemoveCustomerController);
  });

  it('should return 400 if id is not provided', async () => {
    const { sut, removeCustomerStub } = makeSut();
    const removeCustomerSpy = jest.spyOn(removeCustomerStub, 'execute');

    const response = await sut.handle(makeValidRequest({ id: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('id').message,
    });
    expect(removeCustomerSpy).not.toHaveBeenCalled();
  });

  it('should return 400 if password is not provided', async () => {
    const { sut, removeCustomerStub } = makeSut();
    const removeCustomerSpy = jest.spyOn(removeCustomerStub, 'execute');

    const response = await sut.handle(makeValidRequest({ password: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('password').message,
    });
    expect(removeCustomerSpy).not.toHaveBeenCalled();
  });

  it('should call RemoveCustomerPort with actorId, customerId and actorPassword', async () => {
    const { sut, removeCustomerStub } = makeSut();
    const removeCustomerSpy = jest.spyOn(removeCustomerStub, 'execute');

    await sut.handle(makeValidRequest());

    expect(removeCustomerSpy).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      customerId: VALID_CUSTOMER_ID,
      actorPassword: ACTOR_PASSWORD,
    });
  });

  it('should forward empty actorId when the request has none', async () => {
    const { sut, removeCustomerStub } = makeSut();
    const removeCustomerSpy = jest.spyOn(removeCustomerStub, 'execute');

    await sut.handle(makeValidRequest({ actorId: undefined }));

    expect(removeCustomerSpy).toHaveBeenCalledWith({
      actorId: '',
      customerId: VALID_CUSTOMER_ID,
      actorPassword: ACTOR_PASSWORD,
    });
  });

  it('should return 200 if customer is removed successfully', async () => {
    const { sut } = makeSut();

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: { id: VALID_CUSTOMER_ID },
    });
  });

  it('should return 401 if RemoveCustomerPort throws CustomerActorAuthenticationFailedError', async () => {
    const { sut, removeCustomerStub } = makeSut();
    jest
      .spyOn(removeCustomerStub, 'execute')
      .mockRejectedValue(new CustomerActorAuthenticationFailedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication failed' });
  });

  it('should return 409 if RemoveCustomerPort throws CustomerAlreadyRemovedError', async () => {
    const { sut, removeCustomerStub } = makeSut();
    jest
      .spyOn(removeCustomerStub, 'execute')
      .mockRejectedValue(new CustomerAlreadyRemovedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: 'Customer is already removed' });
  });

  it('should return 400 if RemoveCustomerPort throws CustomerNotFoundError', async () => {
    const { sut, removeCustomerStub } = makeSut();
    jest
      .spyOn(removeCustomerStub, 'execute')
      .mockRejectedValue(new CustomerNotFoundError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Customer was not found' });
  });

  it('should return 500 if RemoveCustomerPort throws', async () => {
    const { sut, removeCustomerStub } = makeSut();
    jest
      .spyOn(removeCustomerStub, 'execute')
      .mockRejectedValue(new Error('RemoveCustomerPort error'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'RemoveCustomerPort error',
    });
  });
});
