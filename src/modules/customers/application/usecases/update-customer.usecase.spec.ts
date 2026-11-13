import {
  CustomerAlreadyExistsError,
  CustomerAlreadyRemovedError,
  CustomerNotFoundError,
  EmptyCustomerUpdateDataError,
} from '@modules/customers/domain/errors/customer.errors';
import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { FindCustomerByEmailPort } from '@modules/customers/domain/ports/find-customer-by-email.port';
import { CustomerPatchService } from '@modules/customers/domain/services/customer-patch.service';
import { CustomerPoliciesService } from '@modules/customers/domain/services/customer-policies.service';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidNifError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { FindCustomerByIdPort } from '../ports/outbound/find-customer-by-id.port';
import { UpdateCustomerRepositoryPort } from '../ports/outbound/update-customer-repository.port';
import { UpdateCustomerUsecase } from './update-customer.usecase';

const CUSTOMER_ID = '507f1f77bcf86cd799439011';
const REFERRER_ID = '507f1f77bcf86cd799439012';

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

const makeSut = (snapshot: CustomerModel.toCreate | null = makeSnapshot()) => {
  const findCustomerByEmailStub: FindCustomerByEmailPort = {
    findByEmail: jest.fn().mockResolvedValue(null),
  };
  const findCustomerByIdStub: FindCustomerByIdPort = {
    findById: jest.fn().mockResolvedValue(snapshot),
  };
  const updateCustomerRepositoryStub: UpdateCustomerRepositoryPort = {
    update: jest.fn().mockResolvedValue(true),
  };

  const customerPoliciesService = new CustomerPoliciesService(
    findCustomerByEmailStub,
  );
  const customerPatchService = new CustomerPatchService(
    customerPoliciesService,
  );

  const sut = new UpdateCustomerUsecase(
    customerPatchService,
    findCustomerByIdStub,
    updateCustomerRepositoryStub,
  );

  return {
    sut,
    findCustomerByEmailStub,
    findCustomerByIdStub,
    updateCustomerRepositoryStub,
  };
};

describe('UpdateCustomerUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should persist only the provided field on a partial update', async () => {
    const { sut, findCustomerByEmailStub, updateCustomerRepositoryStub } =
      makeSut();

    const result = await sut.execute({
      id: CUSTOMER_ID,
      name: '  Maria   Santos ',
    });

    expect(result).toEqual({ id: CUSTOMER_ID });
    expect(findCustomerByEmailStub.findByEmail).not.toHaveBeenCalled();
    expect(updateCustomerRepositoryStub.update).toHaveBeenCalledTimes(1);
    expect(updateCustomerRepositoryStub.update).toHaveBeenCalledWith({
      id: CUSTOMER_ID,
      name: 'Maria Santos',
    });
  });

  it('should update all four customer fields in a single write', async () => {
    const { sut, findCustomerByEmailStub, updateCustomerRepositoryStub } =
      makeSut();

    const result = await sut.execute({
      id: CUSTOMER_ID,
      name: 'Maria Santos',
      email: 'maria.santos@example.com',
      phone: '+33 6 12 34 56 78',
      nif: '200000004',
    });

    expect(result).toEqual({ id: CUSTOMER_ID });
    expect(findCustomerByEmailStub.findByEmail).toHaveBeenCalledWith(
      'maria.santos@example.com',
    );
    expect(updateCustomerRepositoryStub.update).toHaveBeenCalledWith({
      id: CUSTOMER_ID,
      name: 'Maria Santos',
      email: 'maria.santos@example.com',
      phone: '33612345678',
      nif: '200000004',
    });
  });

  it('should clear optional phone and nif when null is passed', async () => {
    const { sut, updateCustomerRepositoryStub } = makeSut();

    const result = await sut.execute({
      id: CUSTOMER_ID,
      phone: null,
      nif: null,
    });

    expect(result).toEqual({ id: CUSTOMER_ID });
    expect(updateCustomerRepositoryStub.update).toHaveBeenCalledWith({
      id: CUSTOMER_ID,
      phone: null,
      nif: null,
    });
  });

  it('should skip email occupancy check when the email is unchanged', async () => {
    const { sut, findCustomerByEmailStub, updateCustomerRepositoryStub } =
      makeSut();

    await sut.execute({
      id: CUSTOMER_ID,
      email: '  MARIA.SILVA@EXAMPLE.COM ',
    });

    expect(findCustomerByEmailStub.findByEmail).not.toHaveBeenCalled();
    expect(updateCustomerRepositoryStub.update).toHaveBeenCalledWith({
      id: CUSTOMER_ID,
      email: 'maria.silva@example.com',
    });
  });

  it('should throw EmptyCustomerUpdateDataError when no updatable fields are provided', async () => {
    const { sut, findCustomerByIdStub, updateCustomerRepositoryStub } =
      makeSut();

    await expect(sut.execute({ id: CUSTOMER_ID })).rejects.toBeInstanceOf(
      EmptyCustomerUpdateDataError,
    );
    expect(findCustomerByIdStub.findById).not.toHaveBeenCalled();
    expect(updateCustomerRepositoryStub.update).not.toHaveBeenCalled();
  });

  it('should throw CustomerNotFoundError when customer does not exist', async () => {
    const { sut, updateCustomerRepositoryStub } = makeSut(null);

    await expect(
      sut.execute({ id: CUSTOMER_ID, name: 'Maria Santos' }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
    expect(updateCustomerRepositoryStub.update).not.toHaveBeenCalled();
  });

  it('should throw CustomerAlreadyRemovedError when customer is already removed', async () => {
    const { sut, updateCustomerRepositoryStub } = makeSut(
      makeSnapshot({
        removedAt: new Date('2025-01-01T00:00:00.000Z'),
        email: `removed.${CUSTOMER_ID}@anonymized.invalid`,
        phone: null,
        nif: null,
      }),
    );

    await expect(
      sut.execute({ id: CUSTOMER_ID, name: 'Maria Santos' }),
    ).rejects.toBeInstanceOf(CustomerAlreadyRemovedError);
    expect(updateCustomerRepositoryStub.update).not.toHaveBeenCalled();
  });

  it('should throw CustomerAlreadyRemovedError when concurrent removal makes update return false', async () => {
    const { sut, updateCustomerRepositoryStub } = makeSut();
    jest
      .spyOn(updateCustomerRepositoryStub, 'update')
      .mockResolvedValueOnce(false);

    await expect(
      sut.execute({ id: CUSTOMER_ID, name: 'Maria Santos' }),
    ).rejects.toBeInstanceOf(CustomerAlreadyRemovedError);
  });

  it('should throw CustomerAlreadyExistsError when the new email is already taken', async () => {
    const { sut, findCustomerByEmailStub, updateCustomerRepositoryStub } =
      makeSut();
    jest.spyOn(findCustomerByEmailStub, 'findByEmail').mockResolvedValueOnce(
      makeSnapshot({
        id: '507f1f77bcf86cd799439099',
        email: 'taken@example.com',
      }),
    );

    await expect(
      sut.execute({ id: CUSTOMER_ID, email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(CustomerAlreadyExistsError);
    expect(updateCustomerRepositoryStub.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: 'A' }, InvalidNameError],
    [{ email: 'not-an-email' }, InvalidEmailError],
    [{ phone: '123' }, InvalidPhoneFormatError],
    [{ nif: '111111111' }, InvalidNifError],
  ] as const)(
    'should throw VO error and not persist when given invalid input %o',
    async (invalidFields, ErrorClass) => {
      const { sut, updateCustomerRepositoryStub } = makeSut();

      await expect(
        sut.execute({ id: CUSTOMER_ID, ...invalidFields }),
      ).rejects.toBeInstanceOf(ErrorClass);
      expect(updateCustomerRepositoryStub.update).not.toHaveBeenCalled();
    },
  );
});
