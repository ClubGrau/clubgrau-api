import { UpdateMainEmployeeDataDto } from '@modules/employees/application/dtos/update-main-employee-data.dto';
import { UpdateMainEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-main-employee-data.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyExistsError,
  EmployeeAlreadyRemovedError,
  EmployeeInactiveError,
  EmployeeMainDataForbiddenError,
  EmployeeNotFoundError,
} from '@modules/employees/domain/errors/employee.errors';
import { UpdateMainEmployeeDataRequest } from '@modules/employees/presentation/http/update-main-employee-data.request';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { UpdateMainEmployeeDataController } from './update-main-employee-data.controller';

const VALID_EMPLOYEE_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';

const makeValidRequest = (
  overrides: UpdateMainEmployeeDataRequest = {},
): UpdateMainEmployeeDataRequest => ({
  id: VALID_EMPLOYEE_ID,
  actorId: ACTOR_ID,
  name: 'João Silva',
  ...overrides,
});

const expectExecuteCalledWith = (
  executeSpy: jest.Mock,
  expected: Record<string, unknown>,
) => {
  expect(executeSpy).toHaveBeenCalledTimes(1);
  const dto = executeSpy.mock.calls[0][0] as UpdateMainEmployeeDataDto;
  expect(dto).toBeInstanceOf(UpdateMainEmployeeDataDto);
  expect(dto).toMatchObject(expected);
};

const makeStubs = () => ({
  updateMainEmployeeDataStub: {
    execute: jest.fn().mockResolvedValue({ id: VALID_EMPLOYEE_ID }),
  } satisfies UpdateMainEmployeeDataPort,
});

const makeSut = (): SutTypes => {
  const { updateMainEmployeeDataStub } = makeStubs();
  const sut = new UpdateMainEmployeeDataController(updateMainEmployeeDataStub);
  return { sut, updateMainEmployeeDataStub };
};

type SutTypes = {
  sut: UpdateMainEmployeeDataController;
  updateMainEmployeeDataStub: UpdateMainEmployeeDataPort;
};

describe('UpdateMainEmployeeDataController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateMainEmployeeDataController);
  });

  it('should return 400 if body has no main-data fields', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

    const response = await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('no main-data fields').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should return 400 if body has only unknown keys', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

    const response = await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      role: 'ADMIN',
    } as UpdateMainEmployeeDataRequest);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('no main-data fields').message,
    });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['name', { name: '' }],
    ['email', { email: '   ' }],
    ['phone', { phone: null }],
    ['username', { username: '' }],
    ['username', { username: null }],
    ['username', { username: '   ' }],
  ])(
    'should return 400 when %s is present and blank',
    async (field, overrides) => {
      const { sut, updateMainEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

      const response = await sut.handle(makeValidRequest(overrides));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: `Invalid param ${field}` });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it('should return 400 when status is present in body', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

    const response = await sut.handle(makeValidRequest({ status: 'INACTIVE' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param status' });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should return 400 when password is present in body', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

    const response = await sut.handle(
      makeValidRequest({ password: 'P@ssword123' }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param password' });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should return 400 when username is the only main-data field and blank', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

    const response = await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      username: '',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param username' });
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should call UpdateMainEmployeeDataPort with actorId, id and name only', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      name: 'João Silva',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      name: 'João Silva',
    });
  });

  it('should forward stamped actorId and path id from the flattened request', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

    await sut.handle(makeValidRequest());

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        id: VALID_EMPLOYEE_ID,
      }),
    );
  });

  it('should return 500 when actorId is missing', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateMainEmployeeDataStub, 'execute');

    const response = await sut.handle(makeValidRequest({ actorId: undefined }));

    expect(response.statusCode).toBe(500);
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should return 401 if UpdateMainEmployeeDataPort throws ActorAuthenticationFailedError', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateMainEmployeeDataStub, 'execute')
      .mockRejectedValue(new ActorAuthenticationFailedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication failed' });
  });

  it('should return 403 if UpdateMainEmployeeDataPort throws EmployeeMainDataForbiddenError', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateMainEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeeMainDataForbiddenError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Action not allowed' });
  });

  it.each([
    [new EmployeeAlreadyRemovedError(), 'Employee is already removed'],
    [new EmployeeAlreadyExistsError(), 'Employee already exists'],
    [new EmployeeInactiveError(), 'Employee already exists but is not active'],
  ])(
    'should return 409 if UpdateMainEmployeeDataPort throws %s',
    async (error, message) => {
      const { sut, updateMainEmployeeDataStub } = makeSut();
      jest
        .spyOn(updateMainEmployeeDataStub, 'execute')
        .mockRejectedValue(error);

      const response = await sut.handle(makeValidRequest());

      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ error: message });
    },
  );

  it('should return 400 if UpdateMainEmployeeDataPort throws EmployeeNotFoundError', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateMainEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeeNotFoundError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Employee not found' });
  });

  it.each([
    [new InvalidNameError('Name is required'), 'Name is required'],
    [new InvalidEmailError('Email is required'), 'Email is required'],
    [
      new InvalidPhoneFormatError('Invalid phone format: empty'),
      'Invalid phone format: empty',
    ],
  ])(
    'should return 400 if UpdateMainEmployeeDataPort throws %s',
    async (error, message) => {
      const { sut, updateMainEmployeeDataStub } = makeSut();
      jest
        .spyOn(updateMainEmployeeDataStub, 'execute')
        .mockRejectedValue(error);

      const response = await sut.handle(makeValidRequest());

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: message });
    },
  );

  it('should return 500 if UpdateMainEmployeeDataPort throws', async () => {
    const { sut, updateMainEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateMainEmployeeDataStub, 'execute')
      .mockRejectedValue(new Error('UpdateMainEmployeeDataPort error'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'UpdateMainEmployeeDataPort error',
    });
  });

  it('should return 200 if main data is updated successfully', async () => {
    const { sut } = makeSut();

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: { id: VALID_EMPLOYEE_ID },
    });
  });
});
