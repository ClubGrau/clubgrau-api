import { CreateCustomerDto } from '@modules/customers/application/dtos/create-customer.dto';
import { CreateCustomerPort } from '@modules/customers/application/ports/inbound/create-customer.port';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { CreateCustomerController } from './create-customer.controller';

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
    const { sut } = makeSut();
    const request: CreateCustomerDto = {
      name: '',
      email: 'test@test.com',
    };
    const response = await sut.handle(request);
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('name').message,
    });
  });

  it('should return 400 if email is not provided', async () => {
    const { sut } = makeSut();
    const request: CreateCustomerDto = {
      name: 'John Doe',
      email: '',
    };
    const response = await sut.handle(request);
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('email').message,
    });
  });

  it('should call CreateCustomerPort with correct values', async () => {
    const { sut, createCustomerStub } = makeSut();
    const request: CreateCustomerDto = {
      name: 'John Doe',
      email: 'test@test.com',
      phone: '+351 912 345 678',
      nif: 123456789,
    };
    const createCustomerSpy = jest.spyOn(createCustomerStub, 'execute');
    await sut.handle(request);
    expect(createCustomerSpy).toHaveBeenCalledWith(request);
  });

  it('should forward optional phone and nif when provided', async () => {
    const { sut, createCustomerStub } = makeSut();
    const request: CreateCustomerDto = {
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
    });
  });

  it('should return 500 if CreateCustomerPort throws', async () => {
    const { sut, createCustomerStub } = makeSut();
    const request: CreateCustomerDto = {
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
    });
  });

  it('should return 201 if customer is created successfully', async () => {
    const { sut } = makeSut();
    const request: CreateCustomerDto = {
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
