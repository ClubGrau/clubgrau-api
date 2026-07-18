import { FindEmployeeByEmailPort } from '../ports/find-employee-by-email.port';
import { EmployeePoliciesService } from './employee-policies.service';
import {
  EmployeeAlreadyExistsError,
  EmployeeInactiveError,
} from '../errors/employee.errors';
import { Employee } from '../entities/Employee';
import { EmployeeModel } from '../models/employee.model';

const makeStubs = () => ({
  findEmployeeByEmailStub: {
    findByEmail: jest.fn().mockResolvedValue(null),
  } satisfies FindEmployeeByEmailPort,
});

const makeSut = (): SutTypes => {
  const { findEmployeeByEmailStub } = makeStubs();
  const sut = new EmployeePoliciesService(findEmployeeByEmailStub);
  return { sut, findEmployeeByEmailStub };
};

const makeEmployeeSnapshot = (
  overrides: Partial<EmployeeModel.toCreate> = {},
): EmployeeModel.toCreate => ({
  ...Employee.create({
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'P@ssword123',
    role: EmployeeModel.Role.EMPLOYEE,
  }).toJSON(),
  ...overrides,
});

type SutTypes = {
  sut: EmployeePoliciesService;
  findEmployeeByEmailStub: FindEmployeeByEmailPort;
};

describe('EmployeePoliciesService', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(EmployeePoliciesService);
  });

  it('should call findEmployeeByEmail with correct email', async () => {
    const { sut, findEmployeeByEmailStub } = makeSut();
    const email = 'test@example.com';
    const findByEmailSpy = jest.spyOn(findEmployeeByEmailStub, 'findByEmail');

    await sut.ensureEmailIsAvailable(email);

    expect(findByEmailSpy).toHaveBeenCalledWith(email);
  });

  it('should resolve when no employee exists with the email', async () => {
    const { sut, findEmployeeByEmailStub } = makeSut();
    jest
      .spyOn(findEmployeeByEmailStub, 'findByEmail')
      .mockResolvedValueOnce(null);

    await expect(
      sut.ensureEmailIsAvailable('john.doe@example.com'),
    ).resolves.toBeUndefined();
  });

  it('should throw EmployeeAlreadyExistsError when an active employee exists', async () => {
    const { sut, findEmployeeByEmailStub } = makeSut();
    jest
      .spyOn(findEmployeeByEmailStub, 'findByEmail')
      .mockResolvedValueOnce(makeEmployeeSnapshot({ isActive: true }));

    const result = sut.ensureEmailIsAvailable('john.doe@example.com');

    await expect(result).rejects.toBeInstanceOf(EmployeeAlreadyExistsError);
    await expect(result).rejects.toThrow('Employee already exists');
  });

  it('should throw EmployeeInactiveError when an inactive employee exists', async () => {
    const { sut, findEmployeeByEmailStub } = makeSut();
    jest
      .spyOn(findEmployeeByEmailStub, 'findByEmail')
      .mockResolvedValueOnce(makeEmployeeSnapshot({ isActive: false }));

    const result = sut.ensureEmailIsAvailable('john.doe@example.com');

    await expect(result).rejects.toBeInstanceOf(EmployeeInactiveError);
    await expect(result).rejects.toThrow(
      'Employee already exists but is inactive',
    );
  });
});
