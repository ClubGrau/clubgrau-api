import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '@shared/application/pagination/pagination.dto';
import {
  FindCustomersItem,
  FindCustomersResult,
} from '../dtos/get-customers.dto';
import { FindCustomerNamesByIdsPort } from '../ports/outbound/find-customer-names-by-ids.port';
import { FindCustomersPort } from '../ports/outbound/find-customers.port';
import { FindIndicationOriginNamesByIdsPort } from '../ports/outbound/find-indication-origin-names-by-ids.port';
import { GetCustomersQuery } from './get-customers.query';

const ORIGIN_ID = '507f1f77bcf86cd799439011';
const OTHER_ORIGIN_ID = '507f1f77bcf86cd799439013';
const REFERRER_ID = '507f1f77bcf86cd799439012';

const makeCustomerItem = (
  overrides: Partial<FindCustomersItem> = {},
): FindCustomersItem => ({
  id: 'valid_customer_id',
  name: 'Maria Silva',
  email: 'maria.silva@example.com',
  phone: null,
  nif: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  rank: 'BRONZE',
  indication: null,
  ...overrides,
});

const makeFindResult = (
  overrides: Partial<FindCustomersResult> = {},
): FindCustomersResult => ({
  items: [makeCustomerItem()],
  total: 1,
  ...overrides,
});

const makeSut = () => {
  const findCustomersStub = {
    findAll: jest.fn().mockResolvedValue(makeFindResult()),
  } satisfies FindCustomersPort;
  const findOriginNamesStub = {
    findOriginNamesByIds: jest.fn().mockResolvedValue([]),
  } satisfies FindIndicationOriginNamesByIdsPort;
  const findCustomerNamesStub = {
    findNamesByIds: jest.fn().mockResolvedValue([]),
  } satisfies FindCustomerNamesByIdsPort;

  const sut = new GetCustomersQuery(
    findCustomersStub,
    findOriginNamesStub,
    findCustomerNamesStub,
  );

  return { sut, findCustomersStub, findOriginNamesStub, findCustomerNamesStub };
};

describe('GetCustomersQuery', () => {
  it('should call FindCustomersPort.findAll with normalized pagination defaults', async () => {
    const { sut, findCustomersStub } = makeSut();

    await sut.execute({});

    expect(findCustomersStub.findAll).toHaveBeenCalledWith({
      rank: undefined,
      search: undefined,
      skip: 0,
      limit: DEFAULT_LIMIT,
    });
  });

  it('should forward rank, trimmed search and pagination', async () => {
    const { sut, findCustomersStub } = makeSut();

    await sut.execute({
      rank: 'GOLD',
      search: '  maria  ',
      page: 3,
      limit: 10,
    });

    expect(findCustomersStub.findAll).toHaveBeenCalledWith({
      rank: 'GOLD',
      search: 'maria',
      skip: 20,
      limit: 10,
    });
  });

  it('should treat blank search as undefined', async () => {
    const { sut, findCustomersStub } = makeSut();

    await sut.execute({ search: '   ' });

    expect(findCustomersStub.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });

  it('should coerce string pagination from query params', async () => {
    const { sut, findCustomersStub } = makeSut();

    await sut.execute({ page: '2', limit: '15' });

    expect(findCustomersStub.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 15, limit: 15 }),
    );
  });

  it('should not ask for names when no customer has an indication', async () => {
    const { sut, findOriginNamesStub, findCustomerNamesStub } = makeSut();

    const result = await sut.execute({});

    expect(findOriginNamesStub.findOriginNamesByIds).not.toHaveBeenCalled();
    expect(findCustomerNamesStub.findNamesByIds).not.toHaveBeenCalled();
    expect(result.customers[0]?.indication).toBeNull();
  });

  it('should load origin and referrer names in one batch each, with unique ids', async () => {
    const {
      sut,
      findCustomersStub,
      findOriginNamesStub,
      findCustomerNamesStub,
    } = makeSut();
    findCustomersStub.findAll.mockResolvedValueOnce(
      makeFindResult({
        items: [
          makeCustomerItem({
            id: 'c1',
            indication: { categoryId: 'canal', originId: ORIGIN_ID },
          }),
          makeCustomerItem({
            id: 'c2',
            indication: { categoryId: 'canal', originId: ORIGIN_ID },
          }),
          makeCustomerItem({
            id: 'c3',
            indication: { categoryId: 'campanha', originId: OTHER_ORIGIN_ID },
          }),
          makeCustomerItem({
            id: 'c4',
            indication: {
              categoryId: 'amigo',
              referrerCustomerId: REFERRER_ID,
            },
          }),
        ],
        total: 4,
      }),
    );

    await sut.execute({});

    expect(findOriginNamesStub.findOriginNamesByIds).toHaveBeenCalledTimes(1);
    expect(findOriginNamesStub.findOriginNamesByIds).toHaveBeenCalledWith([
      ORIGIN_ID,
      OTHER_ORIGIN_ID,
    ]);
    expect(findCustomerNamesStub.findNamesByIds).toHaveBeenCalledTimes(1);
    expect(findCustomerNamesStub.findNamesByIds).toHaveBeenCalledWith([
      REFERRER_ID,
    ]);
  });

  it('should merge the indication name into each customer', async () => {
    const {
      sut,
      findCustomersStub,
      findOriginNamesStub,
      findCustomerNamesStub,
    } = makeSut();
    findCustomersStub.findAll.mockResolvedValueOnce(
      makeFindResult({
        items: [
          makeCustomerItem({
            id: 'c1',
            indication: { categoryId: 'canal', originId: ORIGIN_ID },
          }),
          makeCustomerItem({
            id: 'c2',
            indication: {
              categoryId: 'amigo',
              referrerCustomerId: REFERRER_ID,
            },
          }),
          makeCustomerItem({ id: 'c3', indication: null }),
        ],
        total: 3,
      }),
    );
    findOriginNamesStub.findOriginNamesByIds.mockResolvedValueOnce([
      { id: ORIGIN_ID, name: 'Instagram' },
    ]);
    findCustomerNamesStub.findNamesByIds.mockResolvedValueOnce([
      { id: REFERRER_ID, name: 'João Amigo' },
    ]);

    const result = await sut.execute({});

    expect(result.customers.map((customer) => customer.indication)).toEqual([
      { categoryId: 'canal', originId: ORIGIN_ID, name: 'Instagram' },
      {
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
        name: 'João Amigo',
      },
      null,
    ]);
  });

  it('should return name null when a stored id has no row', async () => {
    const { sut, findCustomersStub } = makeSut();
    findCustomersStub.findAll.mockResolvedValueOnce(
      makeFindResult({
        items: [
          makeCustomerItem({
            id: 'c1',
            indication: { categoryId: 'campanha', originId: ORIGIN_ID },
          }),
          makeCustomerItem({
            id: 'c2',
            indication: {
              categoryId: 'amigo',
              referrerCustomerId: REFERRER_ID,
            },
          }),
        ],
        total: 2,
      }),
    );

    const result = await sut.execute({});

    expect(result.customers[0]?.indication).toEqual({
      categoryId: 'campanha',
      originId: ORIGIN_ID,
      name: null,
    });
    expect(result.customers[1]?.indication).toEqual({
      categoryId: 'amigo',
      referrerCustomerId: REFERRER_ID,
      name: null,
    });
  });

  it('should return the paginated envelope', async () => {
    const { sut, findCustomersStub } = makeSut();
    findCustomersStub.findAll.mockResolvedValueOnce(
      makeFindResult({ items: [makeCustomerItem()], total: 42 }),
    );

    const result = await sut.execute({ page: 2, limit: 20 });

    expect(result).toEqual({
      customers: [makeCustomerItem()],
      page: 2,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  });

  it('should return an empty paginated list when nothing is found', async () => {
    const { sut, findCustomersStub } = makeSut();
    findCustomersStub.findAll.mockResolvedValueOnce({ items: [], total: 0 });

    const result = await sut.execute({});

    expect(result).toEqual({
      customers: [],
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      total: 0,
      totalPages: 0,
    });
  });

  it('should propagate errors from the ports', async () => {
    const { sut, findCustomersStub, findOriginNamesStub } = makeSut();
    findCustomersStub.findAll.mockResolvedValueOnce(
      makeFindResult({
        items: [
          makeCustomerItem({
            indication: { categoryId: 'canal', originId: ORIGIN_ID },
          }),
        ],
      }),
    );
    findOriginNamesStub.findOriginNamesByIds.mockRejectedValueOnce(
      new Error('Lookup error'),
    );

    await expect(sut.execute({})).rejects.toThrow('Lookup error');
  });
});
