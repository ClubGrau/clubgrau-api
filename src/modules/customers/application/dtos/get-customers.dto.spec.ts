import {
  GetCustomersDto,
  GetCustomersItemDto,
  GetCustomersResultDto,
} from './get-customers.dto';

describe('GetCustomersDto', () => {
  it('should allow an empty filter object', () => {
    const dto: GetCustomersDto = {};

    expect(dto).toBeDefined();
    expect(dto.rank).toBeUndefined();
    expect(dto.search).toBeUndefined();
    expect(dto.page).toBeUndefined();
    expect(dto.limit).toBeUndefined();
  });

  it('should describe optional list filters and pagination', () => {
    const dto: GetCustomersDto = {
      rank: 'GOLD',
      search: 'maria',
      page: 2,
      limit: 10,
    };

    expect(dto.rank).toBe('GOLD');
    expect(dto.search).toBe('maria');
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });
});

describe('GetCustomersItemDto', () => {
  it('should describe a read model with a resolved indication name', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const item: GetCustomersItemDto = {
      id: 'valid_customer_id',
      name: 'Maria Silva',
      email: 'maria.silva@example.com',
      phone: '351912345678',
      nif: '123456789',
      createdAt,
      rank: 'BRONZE',
      indication: {
        categoryId: 'canal',
        originId: '507f1f77bcf86cd799439011',
        name: 'Instagram',
      },
    };

    expect(item.indication).toEqual({
      categoryId: 'canal',
      originId: '507f1f77bcf86cd799439011',
      name: 'Instagram',
    });
    expect(item).not.toHaveProperty('password');
  });

  it('should allow a walk-in with indication null', () => {
    const item: GetCustomersItemDto = {
      id: 'walk_in_id',
      name: 'Walk In',
      email: 'walk.in@example.com',
      phone: null,
      nif: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      rank: 'BRONZE',
      indication: null,
    };

    expect(item.indication).toBeNull();
  });
});

describe('GetCustomersResultDto', () => {
  it('should describe a paginated result carrying the customer list', () => {
    const result: GetCustomersResultDto = {
      customers: [
        {
          id: 'valid_customer_id',
          name: 'Maria Silva',
          email: 'maria.silva@example.com',
          phone: null,
          nif: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          rank: 'BRONZE',
          indication: null,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    };

    expect(result.customers).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});
