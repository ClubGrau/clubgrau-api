import {
  Email,
  InvalidEmailError,
  InvalidNameError,
  InvalidNifError,
  InvalidPhoneFormatError,
  Name,
  Nif,
  Phone,
} from '@shared/domain/value-object';
import { Customer } from '../entities/Customer';
import {
  CustomerAlreadyExistsError,
  CustomerAlreadyRemovedError,
} from '../errors/customer.errors';
import { FindCustomerByEmailPort } from '../ports/find-customer-by-email.port';
import { Indication } from '../value-objects/indication.vo';
import { CustomerPatchService } from './customer-patch.service';
import { CustomerPoliciesService } from './customer-policies.service';

const CUSTOMER_ID = '507f1f77bcf86cd799439011';
const REFERRER_ID = '507f1f77bcf86cd799439012';

const makeCustomer = (
  overrides: {
    removedAt?: Date | null;
    email?: string;
    phone?: string | null;
    nif?: string | null;
  } = {},
): Customer =>
  Customer.reconstitute({
    id: CUSTOMER_ID,
    name: Name.create('Maria Silva'),
    email: Email.create(overrides.email ?? 'maria.silva@example.com'),
    phone:
      overrides.phone === undefined
        ? Phone.create('+351 912 345 678')
        : overrides.phone === null
          ? null
          : Phone.create(overrides.phone),
    nif:
      overrides.nif === undefined
        ? Nif.create('123456789')
        : overrides.nif === null
          ? null
          : Nif.create(overrides.nif),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    rank: 'SILVER',
    indication: Indication.reconstitute({
      categoryId: 'amigo',
      referrerCustomerId: REFERRER_ID,
    }),
    removedAt: overrides.removedAt ?? null,
  });

const makeSut = () => {
  const findCustomerByEmailStub: FindCustomerByEmailPort = {
    findByEmail: jest.fn().mockResolvedValue(null),
  };
  const customerPoliciesService = new CustomerPoliciesService(
    findCustomerByEmailStub,
  );
  const sut = new CustomerPatchService(customerPoliciesService);

  return { sut, findCustomerByEmailStub, customerPoliciesService };
};

describe('CustomerPatchService', () => {
  it('should patch only name when only name is provided and keep other fields intact', async () => {
    const { sut, findCustomerByEmailStub } = makeSut();
    const customer = makeCustomer();

    const patch = await sut.apply(customer, { name: '  Maria   Santos  ' });

    expect(patch).toEqual({ name: 'Maria Santos' });
    expect(findCustomerByEmailStub.findByEmail).not.toHaveBeenCalled();
    expect(customer.toJSON()).toMatchObject({
      name: 'Maria Santos',
      email: 'maria.silva@example.com',
      phone: '351912345678',
      nif: '123456789',
      rank: 'SILVER',
      indication: {
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
      },
    });
  });

  it('should check email occupancy and update when email changes', async () => {
    const { sut, findCustomerByEmailStub } = makeSut();
    const customer = makeCustomer();

    const patch = await sut.apply(customer, {
      email: '  NOVA.MARIA@EXAMPLE.COM ',
    });

    expect(findCustomerByEmailStub.findByEmail).toHaveBeenCalledWith(
      'nova.maria@example.com',
    );
    expect(patch).toEqual({ email: 'nova.maria@example.com' });
    expect(customer.email.value).toBe('nova.maria@example.com');
  });

  it('should skip email occupancy check when normalized email matches current email', async () => {
    const { sut, findCustomerByEmailStub } = makeSut();
    const customer = makeCustomer();

    const patch = await sut.apply(customer, {
      email: '  MARIA.SILVA@EXAMPLE.COM  ',
    });

    expect(findCustomerByEmailStub.findByEmail).not.toHaveBeenCalled();
    expect(patch).toEqual({ email: 'maria.silva@example.com' });
  });

  it('should throw CustomerAlreadyExistsError and not mutate customer when new email is taken', async () => {
    const { sut, findCustomerByEmailStub } = makeSut();
    const customer = makeCustomer();
    jest.spyOn(findCustomerByEmailStub, 'findByEmail').mockResolvedValueOnce({
      ...customer.toJSON(),
      id: '507f1f77bcf86cd799439099',
      email: 'taken@example.com',
    });

    await expect(
      sut.apply(customer, {
        name: 'Updated Name',
        email: 'taken@example.com',
      }),
    ).rejects.toBeInstanceOf(CustomerAlreadyExistsError);

    expect(customer.toJSON().name).toBe('Maria Silva');
    expect(customer.toJSON().email).toBe('maria.silva@example.com');
  });

  it('should update and clear phone and nif', async () => {
    const { sut } = makeSut();
    const customer = makeCustomer();

    const updatedPatch = await sut.apply(customer, {
      phone: '+33 6 12 34 56 78',
      nif: '200000004',
    });

    expect(updatedPatch).toEqual({
      phone: '33612345678',
      nif: '200000004',
    });
    expect(customer.toJSON()).toMatchObject({
      phone: '33612345678',
      nif: '200000004',
    });

    const clearedPatch = await sut.apply(customer, {
      phone: null,
      nif: null,
    });

    expect(clearedPatch).toEqual({
      phone: null,
      nif: null,
    });
    expect(customer.toJSON()).toMatchObject({
      phone: null,
      nif: null,
    });
  });

  it('should fail fast on invalid VOs before checking email occupancy or mutating entity', async () => {
    const { sut, findCustomerByEmailStub } = makeSut();
    const customer = makeCustomer();

    await expect(
      sut.apply(customer, {
        email: 'new@example.com',
        nif: '111111111',
      }),
    ).rejects.toBeInstanceOf(InvalidNifError);

    expect(findCustomerByEmailStub.findByEmail).not.toHaveBeenCalled();
    expect(customer.email.value).toBe('maria.silva@example.com');

    await expect(sut.apply(customer, { name: 'A' })).rejects.toBeInstanceOf(
      InvalidNameError,
    );
    await expect(
      sut.apply(customer, { email: 'invalid' }),
    ).rejects.toBeInstanceOf(InvalidEmailError);
    await expect(sut.apply(customer, { phone: '123' })).rejects.toBeInstanceOf(
      InvalidPhoneFormatError,
    );
  });

  it('should throw CustomerAlreadyRemovedError when customer is removed', async () => {
    const { sut, findCustomerByEmailStub } = makeSut();
    const customer = makeCustomer({
      removedAt: new Date('2025-01-01T00:00:00.000Z'),
      email: `removed.${CUSTOMER_ID}@anonymized.invalid`,
      phone: null,
      nif: null,
    });

    await expect(
      sut.apply(customer, { name: 'Restored Name' }),
    ).rejects.toBeInstanceOf(CustomerAlreadyRemovedError);
    expect(findCustomerByEmailStub.findByEmail).not.toHaveBeenCalled();
  });
});
