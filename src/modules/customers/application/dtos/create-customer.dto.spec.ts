import {
  CreateCustomerDto,
  CreateCustomerResultDto,
} from './create-customer.dto';

describe('CreateCustomerDto', () => {
  it('should describe the create-customer use case input', () => {
    const dto: CreateCustomerDto = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    expect(dto).toBeDefined();
    expect(dto.name).toBe('John Doe');
    expect(dto.email).toBe('john@example.com');
  });

  it('should accept optional phone and nif', () => {
    const dto: CreateCustomerDto = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+351 912 345 678',
      nif: 123456789,
    };

    expect(dto.phone).toBe('+351 912 345 678');
    expect(dto.nif).toBe(123456789);
  });
});

describe('CreateCustomerResultDto', () => {
  it('should describe a result carrying the created customer id', () => {
    const result: CreateCustomerResultDto = {
      id: 'valid_customer_id',
    };

    expect(result).toBeDefined();
    expect(result.id).toBe('valid_customer_id');
  });
});
