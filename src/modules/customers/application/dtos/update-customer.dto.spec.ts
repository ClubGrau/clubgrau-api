import {
  UpdateCustomerDto,
  UpdateCustomerResultDto,
} from './update-customer.dto';

describe('UpdateCustomerDto', () => {
  it('should describe a sparse update-customer use case input', () => {
    const dto: UpdateCustomerDto = {
      id: '507f1f77bcf86cd799439011',
      name: 'Maria Santos',
    };

    expect(dto.id).toBe('507f1f77bcf86cd799439011');
    expect(dto.name).toBe('Maria Santos');
    expect(dto.email).toBeUndefined();
  });

  it('should accept clearing optional phone and nif with null', () => {
    const dto: UpdateCustomerDto = {
      id: '507f1f77bcf86cd799439011',
      phone: null,
      nif: null,
    };

    expect(dto.phone).toBeNull();
    expect(dto.nif).toBeNull();
  });
});

describe('UpdateCustomerResultDto', () => {
  it('should describe a result carrying the updated customer id', () => {
    const result: UpdateCustomerResultDto = {
      id: '507f1f77bcf86cd799439011',
    };

    expect(result.id).toBe('507f1f77bcf86cd799439011');
  });
});
