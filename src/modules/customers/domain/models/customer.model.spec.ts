import { Customer } from '../entities/Customer';
import { CustomerModel } from './customer.model';

describe('CustomerModel.toCreate', () => {
  it('should match the serialized shape of a Customer', () => {
    const customer = Customer.create({
      name: 'John Doe',
      email: 'john@example.com',
    });

    const toCreate: CustomerModel.toCreate = customer.toJSON();

    expect(toCreate.id).toEqual(expect.any(String));
    expect(toCreate.name).toBe('John Doe');
    expect(toCreate.email).toBe('john@example.com');
    expect(toCreate.phone).toBeNull();
    expect(toCreate.nif).toBeNull();
    expect(toCreate.rank).toBe('BRONZE');
    expect(toCreate.indication).toBeNull();
    expect(toCreate.createdAt).toBeInstanceOf(Date);
  });
});
