import {
  GetEmployeesDto,
  GetEmployeesItemDto,
} from '@modules/employees/application/dtos/get-employees.dto';
import { GetEmployeesPort } from '@modules/employees/application/ports/inbound/get-employees.port';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { GetEmployeesController } from './get-employees.controller';

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

const makeStubs = () => ({
  getEmployeesStub: {
    execute: jest.fn().mockResolvedValue([makeEmployeeItem()]),
  } satisfies GetEmployeesPort,
});

const makeSut = (): SutTypes => {
  const { getEmployeesStub } = makeStubs();
  const sut = new GetEmployeesController(getEmployeesStub);
  return { sut, getEmployeesStub };
};

type SutTypes = {
  sut: GetEmployeesController;
  getEmployeesStub: GetEmployeesPort;
};

describe('GetEmployeesController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetEmployeesController);
  });

  it('should call GetEmployeesPort with correct values', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const request: GetEmployeesDto = {
      isActive: true,
      role: EmployeeModel.Role.MANAGER,
    };
    const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

    await sut.handle(request);

    expect(getEmployeesSpy).toHaveBeenCalledWith(request);
  });

  it('should call GetEmployeesPort with empty filters when request has none', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

    await sut.handle({});

    expect(getEmployeesSpy).toHaveBeenCalledWith({
      isActive: undefined,
      role: undefined,
    });
  });

  it('should return 500 if GetEmployeesPort throws', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const getEmployeesSpy = jest
      .spyOn(getEmployeesStub, 'execute')
      .mockRejectedValue(new Error('GetEmployeesPort error'));

    const response = await sut.handle({});

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'GetEmployeesPort error',
    });
    expect(getEmployeesSpy).toHaveBeenCalledWith({
      isActive: undefined,
      role: undefined,
    });
  });

  it('should return 200 with employees when GetEmployeesPort succeeds', async () => {
    const { sut } = makeSut();
    const employees = [makeEmployeeItem()];

    const response = await sut.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: { employees },
    });
  });

  it('should return 200 with an empty list when no employees are found', async () => {
    const { sut, getEmployeesStub } = makeSut();
    jest.spyOn(getEmployeesStub, 'execute').mockResolvedValueOnce([]);

    const response = await sut.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: { employees: [] },
    });
  });
});
