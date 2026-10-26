import {
  GetCustomersItemDto,
  GetCustomersResultDto,
} from '@modules/customers/application/dtos/get-customers.dto';
import { GetCustomersPort } from '@modules/customers/application/ports/inbound/get-customers.port';
import { GetCustomersRequest } from '@modules/customers/presentation/http/get-customers.request';
import { GetCustomersController } from './get-customers.controller';

const makeCustomerItem = (
  overrides: Partial<GetCustomersItemDto> = {},
): GetCustomersItemDto => ({
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

const makePaginatedResult = (
  overrides: Partial<GetCustomersResultDto> = {},
): GetCustomersResultDto => ({
  customers: [makeCustomerItem()],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  ...overrides,
});

const makeStubs = () => ({
  getCustomersStub: {
    execute: jest.fn().mockResolvedValue(makePaginatedResult()),
  } satisfies GetCustomersPort,
});

const makeSut = (): SutTypes => {
  const { getCustomersStub } = makeStubs();
  const sut = new GetCustomersController(getCustomersStub);
  return { sut, getCustomersStub };
};

type SutTypes = {
  sut: GetCustomersController;
  getCustomersStub: GetCustomersPort;
};

describe('GetCustomersController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetCustomersController);
  });

  it('should call GetCustomersPort with normalized filters and pagination', async () => {
    const { sut, getCustomersStub } = makeSut();
    const request: GetCustomersRequest = {
      rank: 'GOLD',
      search: '  maria  ',
      page: 2,
      limit: 10,
    };
    const getCustomersSpy = jest.spyOn(getCustomersStub, 'execute');

    await sut.handle(request);

    expect(getCustomersSpy).toHaveBeenCalledWith({
      rank: 'GOLD',
      search: 'maria',
      page: 2,
      limit: 10,
    });
  });

  it('should call GetCustomersPort with empty filters when request has none', async () => {
    const { sut, getCustomersStub } = makeSut();
    const getCustomersSpy = jest.spyOn(getCustomersStub, 'execute');

    await sut.handle({});

    expect(getCustomersSpy).toHaveBeenCalledWith({
      rank: undefined,
      search: undefined,
      page: undefined,
      limit: undefined,
    });
  });

  it('should omit blank rank and search', async () => {
    const { sut, getCustomersStub } = makeSut();
    const getCustomersSpy = jest.spyOn(getCustomersStub, 'execute');

    await sut.handle({ rank: '', search: '   ' });

    expect(getCustomersSpy).toHaveBeenCalledWith({
      rank: undefined,
      search: undefined,
      page: undefined,
      limit: undefined,
    });
  });

  it('should return 400 when rank is invalid', async () => {
    const { sut, getCustomersStub } = makeSut();
    const getCustomersSpy = jest.spyOn(getCustomersStub, 'execute');

    const response = await sut.handle({ rank: 'bronze' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param rank' });
    expect(getCustomersSpy).not.toHaveBeenCalled();
  });

  it.each(['BRONZE', 'SILVER', 'GOLD'] as const)(
    'should call GetCustomersPort with rank %s when it is a valid rank',
    async (rank) => {
      const { sut, getCustomersStub } = makeSut();
      const getCustomersSpy = jest.spyOn(getCustomersStub, 'execute');

      await sut.handle({ rank });

      expect(getCustomersSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rank }),
      );
    },
  );

  it('should return 500 if GetCustomersPort throws', async () => {
    const { sut, getCustomersStub } = makeSut();
    const getCustomersSpy = jest
      .spyOn(getCustomersStub, 'execute')
      .mockRejectedValue(new Error('GetCustomersPort error'));

    const response = await sut.handle({});

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'GetCustomersPort error',
    });
    expect(getCustomersSpy).toHaveBeenCalledWith({
      rank: undefined,
      search: undefined,
      page: undefined,
      limit: undefined,
    });
  });

  it('should return 200 with paginated customers when GetCustomersPort succeeds', async () => {
    const { sut } = makeSut();
    const result = makePaginatedResult();

    const response = await sut.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: result,
    });
  });

  it('should return 200 with an empty paginated list when no customers are found', async () => {
    const { sut, getCustomersStub } = makeSut();
    const emptyResult = makePaginatedResult({
      customers: [],
      total: 0,
      totalPages: 0,
    });
    jest.spyOn(getCustomersStub, 'execute').mockResolvedValueOnce(emptyResult);

    const response = await sut.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: emptyResult,
    });
  });
});
