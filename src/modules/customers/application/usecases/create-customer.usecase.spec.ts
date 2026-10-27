import { CreateCustomerUsecase } from './create-customer.usecase';
import { Customer } from '@modules/customers/domain/entities/Customer';
import {
  CustomerAlreadyExistsError,
  CustomerIndicationInvalidError,
  CustomerIndicationOriginCategoryMismatchError,
  CustomerIndicationOriginEndedError,
  CustomerIndicationOriginNotFoundError,
  CustomerReferrerNotFoundError,
} from '@modules/customers/domain/errors/customer.errors';
import { CustomerPoliciesService } from '@modules/customers/domain/services/customer-policies.service';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPhoneFormatError,
  InvalidUniqueEntityIdError,
} from '@shared/domain/value-object';
import { FindCustomerByEmailPort } from '@modules/customers/domain/ports/find-customer-by-email.port';
import { CreateCustomerDto } from '../dtos/create-customer.dto';
import { CreateCustomerRepositoryPort } from '../ports/outbound/create-customer-repository.port';
import { ExistsCustomerByIdPort } from '../ports/outbound/exists-customer-by-id.port';
import { FindIndicationOriginPort } from '../ports/outbound/find-indication-origin.port';

const ORIGIN_ID = '507f1f77bcf86cd799439011';
const REFERRER_ID = '507f1f77bcf86cd799439012';

const makeStubs = () => ({
  customerPoliciesServiceStub: new CustomerPoliciesService({
    findByEmail: jest.fn().mockResolvedValue(null),
  } satisfies FindCustomerByEmailPort),
  findIndicationOriginStub: {
    findOrigin: jest.fn().mockResolvedValue(null),
  } satisfies FindIndicationOriginPort,
  existsCustomerByIdStub: {
    existsById: jest.fn().mockResolvedValue(false),
  } satisfies ExistsCustomerByIdPort,
  createCustomerRepositoryStub: {
    create: jest.fn().mockResolvedValue({ id: 'valid_customer_id' }),
  } satisfies CreateCustomerRepositoryPort,
});

const makeSut = (): SutTypes => {
  const {
    customerPoliciesServiceStub,
    findIndicationOriginStub,
    existsCustomerByIdStub,
    createCustomerRepositoryStub,
  } = makeStubs();
  const sut = new CreateCustomerUsecase(
    customerPoliciesServiceStub,
    findIndicationOriginStub,
    existsCustomerByIdStub,
    createCustomerRepositoryStub,
  );
  return {
    sut,
    customerPoliciesServiceStub,
    findIndicationOriginStub,
    existsCustomerByIdStub,
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
  findIndicationOriginStub: FindIndicationOriginPort;
  existsCustomerByIdStub: ExistsCustomerByIdPort;
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
    const {
      sut,
      customerPoliciesServiceStub,
      findIndicationOriginStub,
      existsCustomerByIdStub,
      createCustomerRepositoryStub,
    } = makeSut();
    jest
      .spyOn(customerPoliciesServiceStub, 'ensureEmailIsAvailable')
      .mockRejectedValueOnce(new CustomerAlreadyExistsError());

    const execute = () => sut.execute(makeValidParams());

    await expect(execute).rejects.toBeInstanceOf(CustomerAlreadyExistsError);
    expect(findIndicationOriginStub.findOrigin).not.toHaveBeenCalled();
    expect(existsCustomerByIdStub.existsById).not.toHaveBeenCalled();
    expect(createCustomerRepositoryStub.create).not.toHaveBeenCalled();
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
        rank: 'BRONZE',
        indication: null,
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
        indication: null,
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

  describe('indication', () => {
    it('walk-in create does not call indication ports', async () => {
      const {
        sut,
        findIndicationOriginStub,
        existsCustomerByIdStub,
        createCustomerRepositoryStub,
      } = makeSut();

      await sut.execute(makeValidParams());
      await sut.execute(makeValidParams({ indication: null }));

      expect(findIndicationOriginStub.findOrigin).not.toHaveBeenCalled();
      expect(existsCustomerByIdStub.existsById).not.toHaveBeenCalled();
      expect(createCustomerRepositoryStub.create).toHaveBeenCalledTimes(2);
      expect(createCustomerRepositoryStub.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rank: 'BRONZE',
          indication: null,
        }),
      );
    });

    it('origin indication calls findOrigin and persists when linkable', async () => {
      const {
        sut,
        findIndicationOriginStub,
        existsCustomerByIdStub,
        createCustomerRepositoryStub,
      } = makeSut();
      jest.spyOn(findIndicationOriginStub, 'findOrigin').mockResolvedValueOnce({
        id: ORIGIN_ID,
        categoryId: 'canal',
        active: true,
      });

      await sut.execute(
        makeValidParams({
          indication: {
            categoryId: 'canal',
            originId: ORIGIN_ID,
            referrerCustomerId: null,
          },
        }),
      );

      expect(findIndicationOriginStub.findOrigin).toHaveBeenCalledWith(
        ORIGIN_ID,
      );
      expect(existsCustomerByIdStub.existsById).not.toHaveBeenCalled();
      expect(createCustomerRepositoryStub.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rank: 'BRONZE',
          indication: { categoryId: 'canal', originId: ORIGIN_ID },
        }),
      );
    });

    it('findOrigin receives lowercased origin id', async () => {
      const { sut, findIndicationOriginStub } = makeSut();
      const mixedCaseOriginId = '507F1F77BCF86CD799439011';
      jest.spyOn(findIndicationOriginStub, 'findOrigin').mockResolvedValueOnce({
        id: ORIGIN_ID,
        categoryId: 'canal',
        active: true,
      });

      await sut.execute(
        makeValidParams({
          indication: {
            categoryId: 'canal',
            originId: mixedCaseOriginId,
            referrerCustomerId: null,
          },
        }),
      );

      expect(findIndicationOriginStub.findOrigin).toHaveBeenCalledWith(
        ORIGIN_ID,
      );
    });

    it('rejects when findOrigin returns null', async () => {
      const { sut, createCustomerRepositoryStub } = makeSut();

      await expect(
        sut.execute(
          makeValidParams({
            indication: {
              categoryId: 'canal',
              originId: ORIGIN_ID,
              referrerCustomerId: null,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(CustomerIndicationOriginNotFoundError);
      expect(createCustomerRepositoryStub.create).not.toHaveBeenCalled();
    });

    it('rejects when origin categoryId differs from facts', async () => {
      const { sut, findIndicationOriginStub, createCustomerRepositoryStub } =
        makeSut();
      jest.spyOn(findIndicationOriginStub, 'findOrigin').mockResolvedValueOnce({
        id: ORIGIN_ID,
        categoryId: 'campanha',
        active: true,
      });

      await expect(
        sut.execute(
          makeValidParams({
            indication: {
              categoryId: 'canal',
              originId: ORIGIN_ID,
              referrerCustomerId: null,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(CustomerIndicationOriginCategoryMismatchError);
      expect(createCustomerRepositoryStub.create).not.toHaveBeenCalled();
    });

    it('rejects when origin is inactive with matching category', async () => {
      const { sut, findIndicationOriginStub, createCustomerRepositoryStub } =
        makeSut();
      jest.spyOn(findIndicationOriginStub, 'findOrigin').mockResolvedValueOnce({
        id: ORIGIN_ID,
        categoryId: 'canal',
        active: false,
      });

      await expect(
        sut.execute(
          makeValidParams({
            indication: {
              categoryId: 'canal',
              originId: ORIGIN_ID,
              referrerCustomerId: null,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(CustomerIndicationOriginEndedError);
      expect(createCustomerRepositoryStub.create).not.toHaveBeenCalled();
    });

    it('friend indication calls existsById and persists when referrer exists', async () => {
      const {
        sut,
        findIndicationOriginStub,
        existsCustomerByIdStub,
        createCustomerRepositoryStub,
      } = makeSut();
      jest
        .spyOn(existsCustomerByIdStub, 'existsById')
        .mockResolvedValueOnce(true);

      await sut.execute(
        makeValidParams({
          indication: {
            categoryId: 'amigo',
            referrerCustomerId: REFERRER_ID,
            originId: null,
          },
        }),
      );

      expect(existsCustomerByIdStub.existsById).toHaveBeenCalledWith(
        REFERRER_ID,
      );
      expect(findIndicationOriginStub.findOrigin).not.toHaveBeenCalled();
      expect(createCustomerRepositoryStub.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rank: 'BRONZE',
          indication: {
            categoryId: 'amigo',
            referrerCustomerId: REFERRER_ID,
          },
        }),
      );
    });

    it('rejects friend indication when referrer does not exist', async () => {
      const { sut, createCustomerRepositoryStub } = makeSut();

      await expect(
        sut.execute(
          makeValidParams({
            indication: {
              categoryId: 'amigo',
              referrerCustomerId: REFERRER_ID,
              originId: null,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(CustomerReferrerNotFoundError);
      expect(createCustomerRepositoryStub.create).not.toHaveBeenCalled();
    });

    it('rejects incoherent indication from Customer.create without calling ports', async () => {
      const {
        sut,
        findIndicationOriginStub,
        existsCustomerByIdStub,
        createCustomerRepositoryStub,
      } = makeSut();

      await expect(
        sut.execute(
          makeValidParams({
            indication: {
              categoryId: 'canal',
              originId: ORIGIN_ID,
              referrerCustomerId: REFERRER_ID,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(CustomerIndicationInvalidError);

      await expect(
        sut.execute(
          makeValidParams({
            indication: {
              categoryId: 'unknown',
              originId: ORIGIN_ID,
              referrerCustomerId: null,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(CustomerIndicationInvalidError);

      expect(findIndicationOriginStub.findOrigin).not.toHaveBeenCalled();
      expect(existsCustomerByIdStub.existsById).not.toHaveBeenCalled();
      expect(createCustomerRepositoryStub.create).not.toHaveBeenCalled();
    });

    it('rejects malformed origin id without calling ports or create', async () => {
      const { sut, findIndicationOriginStub, createCustomerRepositoryStub } =
        makeSut();

      await expect(
        sut.execute(
          makeValidParams({
            indication: {
              categoryId: 'canal',
              originId: '',
              referrerCustomerId: null,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(InvalidUniqueEntityIdError);

      await expect(
        sut.execute(
          makeValidParams({
            indication: {
              categoryId: 'canal',
              originId: 'not-a-valid-object-id',
              referrerCustomerId: null,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(InvalidUniqueEntityIdError);

      expect(findIndicationOriginStub.findOrigin).not.toHaveBeenCalled();
      expect(createCustomerRepositoryStub.create).not.toHaveBeenCalled();
    });
  });
});
