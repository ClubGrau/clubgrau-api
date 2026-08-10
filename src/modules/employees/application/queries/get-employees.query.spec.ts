import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '@shared/application/pagination/pagination.dto';
import {
  FindEmployeesResult,
  GetEmployeesDto,
  GetEmployeesItemDto,
} from '../dtos/get-employees.dto';
import { FindEmployeesPort } from '../ports/outbound/find-employees.port';
import { GetEmployeesQuery } from './get-employees.query';

const makeEmployeeItem = (
  overrides: Partial<GetEmployeesItemDto> = {},
): GetEmployeesItemDto => ({
  id: 'valid_employee_id',
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: EmployeeModel.Role.EMPLOYEE,
  phone: null,
  nif: null,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  deactivateAt: null,
  ...overrides,
});

const makeFindResult = (
  overrides: Partial<FindEmployeesResult> = {},
): FindEmployeesResult => ({
  items: [makeEmployeeItem()],
  total: 1,
  ...overrides,
});

const makeStubs = () => ({
  findEmployeesStub: {
    findAll: jest.fn().mockResolvedValue(makeFindResult()),
  } satisfies FindEmployeesPort,
});

const makeSut = (): SutTypes => {
  const { findEmployeesStub } = makeStubs();
  const sut = new GetEmployeesQuery(findEmployeesStub);
  return {
    sut,
    findEmployeesStub,
  };
};

type SutTypes = {
  sut: GetEmployeesQuery;
  findEmployeesStub: FindEmployeesPort;
};

describe('GetEmployeesQuery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetEmployeesQuery);
  });

  it('should expose an execute method', () => {
    const { sut } = makeSut();
    expect(sut.execute).toBeDefined();
    expect(sut.execute).toBeInstanceOf(Function);
  });

  it('should call FindEmployeesPort.findAll with normalized pagination defaults', async () => {
    const { sut, findEmployeesStub } = makeSut();
    const findAllSpy = jest.spyOn(findEmployeesStub, 'findAll');

    await sut.execute({});

    expect(findAllSpy).toHaveBeenCalledWith({
      isActive: undefined,
      role: undefined,
      skip: 0,
      limit: DEFAULT_LIMIT,
    });
  });

  it('should call FindEmployeesPort.findAll with filters and normalized page/limit', async () => {
    const { sut, findEmployeesStub } = makeSut();
    const filters: GetEmployeesDto = {
      isActive: true,
      role: EmployeeModel.Role.MANAGER,
      page: 3,
      limit: 10,
    };
    const findAllSpy = jest.spyOn(findEmployeesStub, 'findAll');

    await sut.execute(filters);

    expect(findAllSpy).toHaveBeenCalledTimes(1);
    expect(findAllSpy).toHaveBeenCalledWith({
      isActive: true,
      role: EmployeeModel.Role.MANAGER,
      skip: 20,
      limit: 10,
    });
  });

  it('should coerce string pagination from query params', async () => {
    const { sut, findEmployeesStub } = makeSut();
    const findAllSpy = jest.spyOn(findEmployeesStub, 'findAll');

    await sut.execute({ page: '2', limit: '15' });

    expect(findAllSpy).toHaveBeenCalledWith({
      isActive: undefined,
      role: undefined,
      skip: 15,
      limit: 15,
    });
  });

  it('should return a paginated result from FindEmployeesPort', async () => {
    const { sut, findEmployeesStub } = makeSut();
    const items = [
      makeEmployeeItem({ id: 'employee_1' }),
      makeEmployeeItem({
        id: 'employee_2',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        role: EmployeeModel.Role.MANAGER,
      }),
    ];
    jest.spyOn(findEmployeesStub, 'findAll').mockResolvedValueOnce({
      items,
      total: 42,
    });

    const result = await sut.execute({ page: 2, limit: 20 });

    expect(result).toEqual({
      employees: items,
      page: 2,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
    expect(result.employees[0]).not.toHaveProperty('password');
    expect(result.employees[1]).not.toHaveProperty('password');
  });

  it('should return an empty paginated list when FindEmployeesPort finds nothing', async () => {
    const { sut, findEmployeesStub } = makeSut();
    jest.spyOn(findEmployeesStub, 'findAll').mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    const result = await sut.execute({});

    expect(result).toEqual({
      employees: [],
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      total: 0,
      totalPages: 0,
    });
  });

  it('should propagate errors from FindEmployeesPort', async () => {
    const { sut, findEmployeesStub } = makeSut();
    jest
      .spyOn(findEmployeesStub, 'findAll')
      .mockRejectedValueOnce(new Error('Repository error'));

    await expect(sut.execute({})).rejects.toThrow('Repository error');
  });
});
