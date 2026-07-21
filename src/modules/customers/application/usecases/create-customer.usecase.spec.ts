import { CreateCustomerUsecase } from './create-customer.usecase';
import { Customer } from '@modules/customers/domain/entities/Customer';
import { CustomerAlreadyExistsError } from '@modules/customers/domain/errors/customer.errors';
import { CustomerPoliciesService } from '@modules/customers/domain/services/customer-policies.service';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { FindCustomerByEmailPort } from '@modules/customers/domain/ports/find-customer-by-email.port';
import { CreateCustomerDto } from '../dtos/create-customer.dto';
import { CreateCustomerRepositoryPort } from '../ports/outbound/create-customer-repository.port';

const makeStubs = () => ({
  customerPoliciesServiceStub: new CustomerPoliciesService({
    findByEmail: jest.fn().mockResolvedValue(null),
  } satisfies FindCustomerByEmailPort),
  createCustomerRepositoryStub: {
    create: jest.fn().mockResolvedValue({ id: 'valid_customer_id' }),
  } satisfies CreateCustomerRepositoryPort,
});

const makeSut = (): SutTypes => {
  const { customerPoliciesServiceStub, createCustomerRepositoryStub } =
    makeStubs();
  const sut = new CreateCustomerUsecase(
    customerPoliciesServiceStub,
    createCustomerRepositoryStub,
  );
  return {
    sut,
    customerPoliciesServiceStub,
    createCustomerRepositoryStub,
  };
};

const makeValidParams = (
  overrides: Partial<CreateCustomerDto> = {},
): CreateCustomerDto => ({
  name: 'John Doe',
  email: 'john.doe@example.com',
  ...overrides,
});

type SutTypes = {
  sut: CreateCustomerUsecase;
  customerPoliciesServiceStub: CustomerPoliciesService;
  createCustomerRepositoryStub: CreateCustomerRepositoryPort;
};

describe('CreateCustomerUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CreateCustomerUsecase);
  });

  it('should expose a execute method', () => {
    const { sut } = makeSut();
    expect(sut.execute).toBeDefined();
    expect(sut.execute).toBeInstanceOf(Function);
  });

  it('should call CustomerPoliciesService.ensureEmailIsAvailable with correct email', async () => {
    const { sut, customerPoliciesServiceStub } = makeSut();
    const ensureEmailIsAvailableSpy = jest.spyOn(
      customerPoliciesServiceStub,
      'ensureEmailIsAvailable',
    );

    await sut.execute(makeValidParams());

    expect(ensureEmailIsAvailableSpy).toHaveBeenCalledWith(
      'john.doe@example.com',
    );
  });

  it('should propagate CustomerAlreadyExistsError from the policy', async () => {
    const { sut, customerPoliciesServiceStub } = makeSut();
    jest
      .spyOn(customerPoliciesServiceStub, 'ensureEmailIsAvailable')
      .mockRejectedValueOnce(new CustomerAlreadyExistsError());

    const execute = () => sut.execute(makeValidParams());

    await expect(execute).rejects.toBeInstanceOf(CustomerAlreadyExistsError);
  });

  it('should call CreateCustomerRepository with correct params', async () => {
    const { sut, createCustomerRepositoryStub } = makeSut();
    const params = makeValidParams();
    const createSpy = jest.spyOn(createCustomerRepositoryStub, 'create');
    await sut.execute(params);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: null,
        nif: null,
        createdAt: expect.any(Date),
      }),
    );
  });

  it('should throw if createCustomerRepository throws', async () => {
    const { sut, createCustomerRepositoryStub } = makeSut();
    const params = makeValidParams();
    jest
      .spyOn(createCustomerRepositoryStub, 'create')
      .mockRejectedValueOnce(new Error('Repository error'));
    await expect(sut.execute(params)).rejects.toThrow('Repository error');
  });

  it('should return customer id on success', async () => {
    const { sut, createCustomerRepositoryStub } = makeSut();
    const params = makeValidParams();
    const createSpy = jest.spyOn(createCustomerRepositoryStub, 'create');
    const result = await sut.execute(params);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) }),
    );
    expect(result).toEqual({ id: 'valid_customer_id' });
  });

  describe('Customer entity creation', () => {
    it('should create a Customer from the mapped dto fields', async () => {
      const { sut } = makeSut();
      const createSpy = jest.spyOn(Customer, 'create');

      await sut.execute(makeValidParams());

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: undefined,
        nif: undefined,
      });
    });

    it('should forward the optional phone and nif to Customer.create', async () => {
      const { sut } = makeSut();
      const createSpy = jest.spyOn(Customer, 'create');

      await sut.execute(
        makeValidParams({ phone: '+351 912 345 678', nif: 123456789 }),
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+351 912 345 678',
          nif: 123456789,
        }),
      );
    });

    it('should persist normalized phone when provided', async () => {
      const { sut, createCustomerRepositoryStub } = makeSut();
      const createSpy = jest.spyOn(createCustomerRepositoryStub, 'create');

      await sut.execute(makeValidParams({ phone: '+351 912 345 678' }));

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '351912345678' }),
      );
    });

    it('should resolve with customer id when params are valid', async () => {
      const { sut } = makeSut();
      const promise = sut.execute(makeValidParams());
      await expect(promise).resolves.toEqual({ id: 'valid_customer_id' });
    });
  });

  describe('domain validation propagation', () => {
    it('should propagate an error for an invalid name', async () => {
      const { sut } = makeSut();
      const execute = () => sut.execute(makeValidParams({ name: 'A' }));

      await expect(execute).rejects.toBeInstanceOf(InvalidNameError);
    });

    it('should propagate an error for an invalid email', async () => {
      const { sut } = makeSut();
      const execute = () =>
        sut.execute(makeValidParams({ email: 'not-an-email' }));

      await expect(execute).rejects.toBeInstanceOf(InvalidEmailError);
    });

    it('should propagate an error for an invalid phone', async () => {
      const { sut } = makeSut();
      const execute = () => sut.execute(makeValidParams({ phone: '123' }));

      await expect(execute).rejects.toBeInstanceOf(InvalidPhoneFormatError);
    });
  });
});
