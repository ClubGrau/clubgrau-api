import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import {
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
  nif: null,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  deactivateAt: null,
  ...overrides,
});

const makeStubs = () => {
  const employees = [makeEmployeeItem()];
  return {
    findEmployeesStub: {
      findAll: jest.fn().mockResolvedValue(employees),
    } satisfies FindEmployeesPort,
  };
};

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

  it('should call FindEmployeesPort.findAll with the received filters', async () => {
    const { sut, findEmployeesStub } = makeSut();
    const filters: GetEmployeesDto = {
      isActive: true,
      role: EmployeeModel.Role.MANAGER,
    };
    const findAllSpy = jest.spyOn(findEmployeesStub, 'findAll');

    await sut.execute(filters);

    expect(findAllSpy).toHaveBeenCalledTimes(1);
    expect(findAllSpy).toHaveBeenCalledWith(filters);
  });

  it('should call FindEmployeesPort.findAll with an empty filter object', async () => {
    const { sut, findEmployeesStub } = makeSut();
    const findAllSpy = jest.spyOn(findEmployeesStub, 'findAll');

    await sut.execute({});

    expect(findAllSpy).toHaveBeenCalledWith({});
  });

  it('should return the employees from FindEmployeesPort', async () => {
    const { sut, findEmployeesStub } = makeSut();
    const employees = [
      makeEmployeeItem({ id: 'employee_1' }),
      makeEmployeeItem({
        id: 'employee_2',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        role: EmployeeModel.Role.MANAGER,
      }),
    ];
    jest.spyOn(findEmployeesStub, 'findAll').mockResolvedValueOnce(employees);

    const result = await sut.execute({});

    expect(result).toEqual(employees);
    expect(result).toHaveLength(2);
    expect(result[0]).not.toHaveProperty('password');
    expect(result[1]).not.toHaveProperty('password');
  });

  it('should return an empty list when FindEmployeesPort finds nothing', async () => {
    const { sut, findEmployeesStub } = makeSut();
    jest.spyOn(findEmployeesStub, 'findAll').mockResolvedValueOnce([]);

    const result = await sut.execute({});

    expect(result).toEqual([]);
  });

  it('should propagate errors from FindEmployeesPort', async () => {
    const { sut, findEmployeesStub } = makeSut();
    jest
      .spyOn(findEmployeesStub, 'findAll')
      .mockRejectedValueOnce(new Error('Repository error'));

    await expect(sut.execute({})).rejects.toThrow('Repository error');
  });
});
