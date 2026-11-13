import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import {
  CustomerActorAuthenticationFailedError,
  CustomerAlreadyRemovedError,
  CustomerNotFoundError,
} from '@modules/customers/domain/errors/customer.errors';
import { RemoveCustomerDto } from '../dtos/remove-customer.dto';
import { FindCustomerByIdPort } from '../ports/outbound/find-customer-by-id.port';
import { RemoveCustomerRepositoryPort } from '../ports/outbound/remove-customer-repository.port';
import { VerifyActorPasswordPort } from '../ports/outbound/verify-actor-password.port';
import { RemoveCustomerUsecase } from './remove-customer.usecase';

const ACTOR_ID = '507f1f77bcf86cd799439022';
const CUSTOMER_ID = '507f1f77bcf86cd799439011';
const REFERRER_ID = '507f1f77bcf86cd799439012';
const ACTOR_PASSWORD = 'P@ssword123';

const makeSnapshot = (
  overrides: Partial<CustomerModel.toCreate> = {},
): CustomerModel.toCreate => ({
  id: CUSTOMER_ID,
  name: 'Maria Silva',
  email: 'maria.silva@example.com',
  phone: '+351 912 345 678',
  nif: '123456789',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  rank: 'BRONZE',
  indication: {
    categoryId: 'amigo',
    referrerCustomerId: REFERRER_ID,
  },
  removedAt: null,
  ...overrides,
});

const makeParams = (
  overrides: Partial<RemoveCustomerDto> = {},
): RemoveCustomerDto => ({
  actorId: ACTOR_ID,
  customerId: CUSTOMER_ID,
  actorPassword: ACTOR_PASSWORD,
  ...overrides,
});

const makeSut = (snapshot: CustomerModel.toCreate | null = makeSnapshot()) => {
  const verifyActorPasswordStub: VerifyActorPasswordPort = {
    verify: jest.fn().mockResolvedValue(true),
  };
  const findCustomerByIdStub: FindCustomerByIdPort = {
    findById: jest.fn().mockResolvedValue(snapshot),
  };
  const removeCustomerRepositoryStub: RemoveCustomerRepositoryPort = {
    remove: jest.fn().mockResolvedValue(true),
  };

  const sut = new RemoveCustomerUsecase(
    verifyActorPasswordStub,
    findCustomerByIdStub,
    removeCustomerRepositoryStub,
  );

  return {
    sut,
    verifyActorPasswordStub,
    findCustomerByIdStub,
    removeCustomerRepositoryStub,
  };
};

describe('RemoveCustomerUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return the customer id on the happy path and persist the anonymized snapshot', async () => {
    const { sut, verifyActorPasswordStub, removeCustomerRepositoryStub } =
      makeSut();

    const result = await sut.execute(makeParams());

    expect(result).toEqual({ id: CUSTOMER_ID });
    expect(verifyActorPasswordStub.verify).toHaveBeenCalledWith(
      ACTOR_ID,
      ACTOR_PASSWORD,
    );
    expect(removeCustomerRepositoryStub.remove).toHaveBeenCalledTimes(1);

    const persisted = jest.mocked(removeCustomerRepositoryStub.remove).mock
      .calls[0]?.[0];
    expect(persisted).toEqual(
      expect.objectContaining({
        id: CUSTOMER_ID,
        name: 'Maria Silva',
        rank: 'BRONZE',
        email: `removed.${CUSTOMER_ID}@anonymized.invalid`,
        phone: null,
        nif: null,
        indication: {
          categoryId: 'amigo',
          referrerCustomerId: REFERRER_ID,
        },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      }),
    );
    expect(persisted?.removedAt).toBeInstanceOf(Date);
  });

  it('should throw CustomerActorAuthenticationFailedError when actorId is blank and skip downstream ports', async () => {
    const {
      sut,
      verifyActorPasswordStub,
      findCustomerByIdStub,
      removeCustomerRepositoryStub,
    } = makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '   ' })),
    ).rejects.toBeInstanceOf(CustomerActorAuthenticationFailedError);
    expect(verifyActorPasswordStub.verify).not.toHaveBeenCalled();
    expect(findCustomerByIdStub.findById).not.toHaveBeenCalled();
    expect(removeCustomerRepositoryStub.remove).not.toHaveBeenCalled();
  });

  it('should throw CustomerActorAuthenticationFailedError when actorId is missing', async () => {
    const {
      sut,
      verifyActorPasswordStub,
      findCustomerByIdStub,
      removeCustomerRepositoryStub,
    } = makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '' })),
    ).rejects.toBeInstanceOf(CustomerActorAuthenticationFailedError);
    expect(verifyActorPasswordStub.verify).not.toHaveBeenCalled();
    expect(findCustomerByIdStub.findById).not.toHaveBeenCalled();
    expect(removeCustomerRepositoryStub.remove).not.toHaveBeenCalled();
  });

  it('should throw CustomerActorAuthenticationFailedError when verify returns false', async () => {
    const {
      sut,
      verifyActorPasswordStub,
      findCustomerByIdStub,
      removeCustomerRepositoryStub,
    } = makeSut();
    jest.spyOn(verifyActorPasswordStub, 'verify').mockResolvedValueOnce(false);

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      CustomerActorAuthenticationFailedError,
    );
    expect(findCustomerByIdStub.findById).not.toHaveBeenCalled();
    expect(removeCustomerRepositoryStub.remove).not.toHaveBeenCalled();
  });

  it('should propagate errors from verify', async () => {
    const { sut, findCustomerByIdStub, verifyActorPasswordStub } = makeSut();
    jest
      .spyOn(verifyActorPasswordStub, 'verify')
      .mockRejectedValueOnce(new Error('Auth unavailable'));

    await expect(sut.execute(makeParams())).rejects.toThrow('Auth unavailable');
    expect(findCustomerByIdStub.findById).not.toHaveBeenCalled();
  });

  it('should throw CustomerNotFoundError when findById returns null', async () => {
    const { sut, removeCustomerRepositoryStub } = makeSut(null);

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
    expect(removeCustomerRepositoryStub.remove).not.toHaveBeenCalled();
  });

  it('should throw CustomerAlreadyRemovedError when the snapshot is already removed', async () => {
    const removedAt = new Date('2025-01-01T00:00:00.000Z');
    const { sut, removeCustomerRepositoryStub } = makeSut(
      makeSnapshot({
        removedAt,
        email: `removed.${CUSTOMER_ID}@anonymized.invalid`,
        phone: null,
        nif: null,
      }),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      CustomerAlreadyRemovedError,
    );
    expect(removeCustomerRepositoryStub.remove).not.toHaveBeenCalled();
  });

  it('should throw CustomerAlreadyRemovedError when remove returns false', async () => {
    const { sut, removeCustomerRepositoryStub } = makeSut();
    jest
      .spyOn(removeCustomerRepositoryStub, 'remove')
      .mockResolvedValueOnce(false);

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      CustomerAlreadyRemovedError,
    );
  });

  it('should propagate errors from remove', async () => {
    const { sut, removeCustomerRepositoryStub } = makeSut();
    jest
      .spyOn(removeCustomerRepositoryStub, 'remove')
      .mockRejectedValueOnce(new Error('DB error'));

    await expect(sut.execute(makeParams())).rejects.toThrow('DB error');
  });
});
