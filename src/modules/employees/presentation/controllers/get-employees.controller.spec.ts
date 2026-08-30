import {
  GetEmployeesItemDto,
  GetEmployeesResultDto,
} from '@modules/employees/application/dtos/get-employees.dto';
import { GetEmployeesPort } from '@modules/employees/application/ports/inbound/get-employees.port';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { GetEmployeesRequest } from '@modules/employees/presentation/http/get-employees.request';
import { GetEmployeesController } from './get-employees.controller';

const makeEmployeeItem = (
  overrides: Partial<GetEmployeesItemDto> = {},
): GetEmployeesItemDto => ({
  id: 'valid_employee_id',
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: EmployeeModel.Role.EMPLOYEE,
  phone: null,
  nif: null,
  status: EmployeeModel.Status.ACTIVE,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  deactivateAt: null,
  username: null,
  gender: null,
  address: null,
  languages: null,
  emergencyContact: null,
  employmentId: null,
  jobTitle: null,
  ...overrides,
});

const makePaginatedResult = (
  overrides: Partial<GetEmployeesResultDto> = {},
): GetEmployeesResultDto => ({
  employees: [makeEmployeeItem()],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  ...overrides,
});

const makeStubs = () => ({
  getEmployeesStub: {
    execute: jest.fn().mockResolvedValue(makePaginatedResult()),
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

  it('should call GetEmployeesPort with normalized filters and pagination', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const request: GetEmployeesRequest = {
      status: EmployeeModel.Status.ACTIVE,
      role: EmployeeModel.Role.MANAGER,
      search: '  grau  ',
      page: 2,
      limit: 10,
    };
    const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

    await sut.handle(request);

    expect(getEmployeesSpy).toHaveBeenCalledWith({
      status: EmployeeModel.Status.ACTIVE,
      role: EmployeeModel.Role.MANAGER,
      search: 'grau',
      page: 2,
      limit: 10,
    });
  });

  it('should call GetEmployeesPort with empty filters when request has none', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

    await sut.handle({});

    expect(getEmployeesSpy).toHaveBeenCalledWith({
      status: undefined,
      role: undefined,
      search: undefined,
      page: undefined,
      limit: undefined,
    });
  });

  it('should return 400 when status is invalid', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

    const response = await sut.handle({ status: 'active' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param status' });
    expect(getEmployeesSpy).not.toHaveBeenCalled();
  });

  it('should return 400 when status is REMOVED', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

    const response = await sut.handle({ status: EmployeeModel.Status.REMOVED });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param status' });
    expect(getEmployeesSpy).not.toHaveBeenCalled();
  });

  it.each([
    EmployeeModel.Status.ACTIVE,
    EmployeeModel.Status.INACTIVE,
    EmployeeModel.Status.VACATION,
  ])(
    'should call GetEmployeesPort with status %s when it is an operational status',
    async (operationalStatus) => {
      const { sut, getEmployeesStub } = makeSut();
      const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

      await sut.handle({ status: operationalStatus });

      expect(getEmployeesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: operationalStatus }),
      );
    },
  );

  it('should accept VACATION as a valid status filter', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

    await sut.handle({ status: EmployeeModel.Status.VACATION });

    expect(getEmployeesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: EmployeeModel.Status.VACATION }),
    );
  });

  it('should return 400 when role is invalid', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const getEmployeesSpy = jest.spyOn(getEmployeesStub, 'execute');

    const response = await sut.handle({ role: 'ROOT' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param role' });
    expect(getEmployeesSpy).not.toHaveBeenCalled();
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
      status: undefined,
      role: undefined,
      search: undefined,
      page: undefined,
      limit: undefined,
    });
  });

  it('should return 200 with paginated employees when GetEmployeesPort succeeds', async () => {
    const { sut } = makeSut();
    const result = makePaginatedResult();

    const response = await sut.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: result,
    });
  });

  it('should return 200 with an empty paginated list when no employees are found', async () => {
    const { sut, getEmployeesStub } = makeSut();
    const emptyResult = makePaginatedResult({
      employees: [],
      total: 0,
      totalPages: 0,
    });
    jest.spyOn(getEmployeesStub, 'execute').mockResolvedValueOnce(emptyResult);

    const response = await sut.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: emptyResult,
    });
  });
});
