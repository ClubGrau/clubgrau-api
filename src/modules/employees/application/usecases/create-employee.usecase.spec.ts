import { CreateEmployeeUsecase } from './create-employee.usecase';
import { Employee } from '@modules/employees/domain/entities/Employee';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import {
  EmployeeAlreadyExistsError,
  EmployeeInactiveError,
  PasswordNotMatchError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeePoliciesService } from '@modules/employees/domain/services/employee-policies.service';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPasswordError,
} from '@shared/domain/value-object';
import { FindEmployeeByEmailPort } from '../ports/outbound/find-employee-by-email.port';
import { EncrypterPort } from '../ports/outbound/encrypter.port';
import { CreateEmployeeRepositoryPort } from '../ports/outbound/create-employee-repository.port';

const makeStubs = () => ({
  employeePoliciesServiceStub: new EmployeePoliciesService({
    findByEmail: jest.fn().mockResolvedValue(null),
  } satisfies FindEmployeeByEmailPort),
  encrypterStub: {
    encrypt: jest.fn().mockResolvedValue('encrypted-password'),
  } satisfies EncrypterPort,
  createEmployeeRepositoryStub: {
    create: jest.fn().mockResolvedValue({ id: 'valid_employee_id' }),
  } satisfies CreateEmployeeRepositoryPort,
});

const makeSut = (): SutTypes => {
  const {
    employeePoliciesServiceStub,
    encrypterStub,
    createEmployeeRepositoryStub,
  } = makeStubs();
  const sut = new CreateEmployeeUsecase(
    employeePoliciesServiceStub,
    encrypterStub,
    createEmployeeRepositoryStub,
  );
  return {
    sut,
    employeePoliciesServiceStub,
    encrypterStub,
    createEmployeeRepositoryStub,
  };
};

const makeValidParams = (
  overrides: Partial<EmployeeModel.CreateEmployeeDto> = {},
): EmployeeModel.CreateEmployeeDto => ({
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: EmployeeModel.Role.MANAGER,
  password: 'P@ssword123',
  passwordConfirmation: 'P@ssword123',
  ...overrides,
});

type SutTypes = {
  sut: CreateEmployeeUsecase;
  employeePoliciesServiceStub: EmployeePoliciesService;
  encrypterStub: EncrypterPort;
  createEmployeeRepositoryStub: CreateEmployeeRepositoryPort;
};

describe('HireEmployeeUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CreateEmployeeUsecase);
  });

  it('should expose a execute method', () => {
    const { sut } = makeSut();
    expect(sut.execute).toBeDefined();
    expect(sut.execute).toBeInstanceOf(Function);
  });

  it('should return an error if password and passwordConfirmation do not match', async () => {
    const { sut } = makeSut();
    const params = makeValidParams({
      password: 'P@ssword123',
      passwordConfirmation: 'P@ssword456',
    });

    const execute = () => sut.execute(params);
    await expect(execute).rejects.toBeInstanceOf(PasswordNotMatchError);
    await expect(execute).rejects.toThrow(
      'Password and passwordConfirmation do not match',
    );
  });

  it('should not create an employee when passwords do not match', async () => {
    const { sut } = makeSut();
    const createSpy = jest.spyOn(Employee, 'create');
    const params = makeValidParams({
      password: 'P@ssword123',
      passwordConfirmation: 'P@ssword456',
    });

    await expect(sut.execute(params)).rejects.toBeInstanceOf(
      PasswordNotMatchError,
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should call EmployeePoliciesService.ensureEmailIsAvailable with correct email', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();
    const ensureEmailIsAvailableSpy = jest.spyOn(
      employeePoliciesServiceStub,
      'ensureEmailIsAvailable',
    );

    await sut.execute(makeValidParams());

    expect(ensureEmailIsAvailableSpy).toHaveBeenCalledWith(
      'john.doe@example.com',
    );
  });

  it('should propagate EmployeeAlreadyExistsError from the policy', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();
    jest
      .spyOn(employeePoliciesServiceStub, 'ensureEmailIsAvailable')
      .mockRejectedValueOnce(new EmployeeAlreadyExistsError());

    const execute = () => sut.execute(makeValidParams());

    await expect(execute).rejects.toBeInstanceOf(EmployeeAlreadyExistsError);
  });

  it('should propagate EmployeeInactiveError from the policy', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();
    jest
      .spyOn(employeePoliciesServiceStub, 'ensureEmailIsAvailable')
      .mockRejectedValueOnce(new EmployeeInactiveError());

    const execute = () => sut.execute(makeValidParams());

    await expect(execute).rejects.toBeInstanceOf(EmployeeInactiveError);
  });

  it('should call Encrypter with correct plan password', async () => {
    const { sut, encrypterStub } = makeSut();
    const encryptSpy = jest.spyOn(encrypterStub, 'encrypt');
    const params = makeValidParams();
    await sut.execute(params);
    expect(encryptSpy).toHaveBeenCalledWith(params.password);
  });

  it('should throw if encrypter throws', async () => {
    const { sut, encrypterStub } = makeSut();
    const params = makeValidParams();
    jest
      .spyOn(encrypterStub, 'encrypt')
      .mockRejectedValueOnce(new Error('Encryption error'));
    await expect(sut.execute(params)).rejects.toThrow('Encryption error');
  });

  it('should call CreateEmployeeRepository with correct params', async () => {
    const { sut, createEmployeeRepositoryStub } = makeSut();
    const params = makeValidParams();
    const createSpy = jest.spyOn(createEmployeeRepositoryStub, 'create');
    await sut.execute(params);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: EmployeeModel.Role.MANAGER,
        nif: null,
        password: 'encrypted-password',
        isActive: true,
        deactivateAt: null,
        createdAt: expect.any(Date),
      }),
    );
  });

  it('should throw if createEmployeeRepository throws', async () => {
    const { sut, createEmployeeRepositoryStub } = makeSut();
    const params = makeValidParams();
    jest
      .spyOn(createEmployeeRepositoryStub, 'create')
      .mockRejectedValueOnce(new Error('Repository error'));
    await expect(sut.execute(params)).rejects.toThrow('Repository error');
  });

  describe('Employee entity creation', () => {
    it('should create an Employee from the mapped dto fields', async () => {
      const { sut } = makeSut();
      const createSpy = jest.spyOn(Employee, 'create');

      await sut.execute(makeValidParams());

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: EmployeeModel.Role.MANAGER,
        password: 'P@ssword123',
      });
    });

    it('should forward the optional nif to Employee.create', async () => {
      const { sut } = makeSut();
      const createSpy = jest.spyOn(Employee, 'create');

      await sut.execute(makeValidParams({ nif: 123456789 }));

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ nif: 123456789 }),
      );
    });

    it('should resolve when params are valid', async () => {
      const { sut } = makeSut();
      await expect(sut.execute(makeValidParams())).resolves.toBeUndefined();
    });
  });

  describe('domain validation propagation', () => {
    it('should propagate an error for an invalid name', async () => {
      const { sut } = makeSut();
      const execute = () => sut.execute(makeValidParams({ name: 'A' }));

      await expect(execute).rejects.toBeInstanceOf(InvalidNameError);
    });

    it('should propagate an error for an invalid email', async () => {
      const { sut } = makeSut();
      const execute = () =>
        sut.execute(makeValidParams({ email: 'not-an-email' }));

      await expect(execute).rejects.toBeInstanceOf(InvalidEmailError);
    });

    it('should propagate an error for a weak password', async () => {
      const { sut } = makeSut();
      const execute = () =>
        sut.execute(
          makeValidParams({ password: 'weak', passwordConfirmation: 'weak' }),
        );

      await expect(execute).rejects.toBeInstanceOf(InvalidPasswordError);
    });
  });
});
