import { CreateEmployeePort } from '@modules/employees/application/ports/inbound/create-employee.port';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { CreateEmployeeRequest } from '../http/create-employee.request';
import { CreateEmployeeController } from './create-employee.controller';

const makeStubs = () => ({
  createEmployeeStub: {
    execute: jest.fn().mockResolvedValue({ id: 'valid_employee_id' }),
  } satisfies CreateEmployeePort,
});

const makeSut = (): SutTypes => {
  const { createEmployeeStub } = makeStubs();
  const sut = new CreateEmployeeController(createEmployeeStub);
  return { sut, createEmployeeStub };
};

const makeValidRequest = (
  overrides: Partial<CreateEmployeeRequest> = {},
): CreateEmployeeRequest => ({
  name: 'John Doe',
  email: 'test@test.com',
  role: EmployeeModel.Role.EMPLOYEE,
  password: 'P@ssword123',
  passwordConfirmation: 'P@ssword123',
  ...overrides,
});

type SutTypes = {
  sut: CreateEmployeeController;
  createEmployeeStub: CreateEmployeePort;
};

describe('CreateEmployeeController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CreateEmployeeController);
  });

  it('should return 400 if name is not provided', async () => {
    const { sut } = makeSut();
    const response = await sut.handle(makeValidRequest({ name: '' }));
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('name').message,
    });
  });

  it('should return 400 if email is not provided', async () => {
    const { sut } = makeSut();
    const response = await sut.handle(makeValidRequest({ email: '' }));
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('email').message,
    });
  });

  it('should return 400 if password is not provided', async () => {
    const { sut } = makeSut();
    const response = await sut.handle(makeValidRequest({ password: '' }));
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('password').message,
    });
  });

  it('should return 400 if passwordConfirmation is not provided', async () => {
    const { sut } = makeSut();
    const response = await sut.handle(
      makeValidRequest({ passwordConfirmation: '' }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('passwordConfirmation').message,
    });
  });

  it('should call CreateEmployeePort with correct values', async () => {
    const { sut, createEmployeeStub } = makeSut();
    const request = makeValidRequest({
      phone: '+351 912 345 678',
      nif: 123456789,
    });
    const createEmployeeSpy = jest.spyOn(createEmployeeStub, 'execute');
    await sut.handle(request);
    expect(createEmployeeSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      role: EmployeeModel.Role.EMPLOYEE,
      phone: '+351 912 345 678',
      nif: 123456789,
      password: 'P@ssword123',
      passwordConfirmation: 'P@ssword123',
      username: null,
      gender: null,
      address: null,
      languages: null,
      emergencyContact: null,
      employmentId: null,
      jobTitle: null,
    });
  });

  it('should convert nif from string to number', async () => {
    const { sut, createEmployeeStub } = makeSut();
    const createEmployeeSpy = jest.spyOn(createEmployeeStub, 'execute');

    await sut.handle(makeValidRequest({ nif: '123456789' }));

    expect(createEmployeeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ nif: 123456789 }),
    );
  });

  it('should ignore status from the request', async () => {
    const { sut, createEmployeeStub } = makeSut();
    const createEmployeeSpy = jest.spyOn(createEmployeeStub, 'execute');

    await sut.handle(makeValidRequest({ status: 'INACTIVE' }));

    expect(createEmployeeSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: expect.anything() }),
    );
  });

  it('should forward optional profile fields when provided', async () => {
    const { sut, createEmployeeStub } = makeSut();
    const createEmployeeSpy = jest.spyOn(createEmployeeStub, 'execute');

    await sut.handle(
      makeValidRequest({
        username: 'jdoe',
        gender: 'male',
        address: 'Rua do Grau, 10',
        languages: 'pt,en',
        emergencyContact: '+351 910 000 000',
        employmentId: 'HR-001',
        jobTitle: 'Barber',
      }),
    );

    expect(createEmployeeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'jdoe',
        gender: 'male',
        address: 'Rua do Grau, 10',
        languages: 'pt,en',
        emergencyContact: '+351 910 000 000',
        employmentId: 'HR-001',
        jobTitle: 'Barber',
      }),
    );
  });

  it('should forward optional phone and nif when provided', async () => {
    const { sut, createEmployeeStub } = makeSut();
    const createEmployeeSpy = jest.spyOn(createEmployeeStub, 'execute');
    await sut.handle(
      makeValidRequest({
        phone: '+33 6 12 34 56 78',
        nif: 200000004,
      }),
    );
    expect(createEmployeeSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      role: EmployeeModel.Role.EMPLOYEE,
      phone: '+33 6 12 34 56 78',
      nif: 200000004,
      password: 'P@ssword123',
      passwordConfirmation: 'P@ssword123',
      username: null,
      gender: null,
      address: null,
      languages: null,
      emergencyContact: null,
      employmentId: null,
      jobTitle: null,
    });
  });

  it('should return 500 if CreateEmployeePort throws', async () => {
    const { sut, createEmployeeStub } = makeSut();
    const createEmployeeSpy = jest
      .spyOn(createEmployeeStub, 'execute')
      .mockRejectedValue(new Error('CreateEmployeePort error'));
    const response = await sut.handle(makeValidRequest());
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'CreateEmployeePort error',
    });
    expect(createEmployeeSpy).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'test@test.com',
      role: EmployeeModel.Role.EMPLOYEE,
      phone: undefined,
      nif: null,
      password: 'P@ssword123',
      passwordConfirmation: 'P@ssword123',
      username: null,
      gender: null,
      address: null,
      languages: null,
      emergencyContact: null,
      employmentId: null,
      jobTitle: null,
    });
  });

  it('should return 201 if employee is created successfully', async () => {
    const { sut } = makeSut();
    const response = await sut.handle(makeValidRequest());
    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      data: { id: 'valid_employee_id' },
    });
  });
});
