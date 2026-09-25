import { UpdatePersonalEmployeeDataDto } from '@modules/employees/application/dtos/update-personal-employee-data.dto';
import { UpdatePersonalEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-personal-employee-data.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeNotFoundError,
  EmployeePersonalDataForbiddenError,
  EmptyPersonalEmployeeDataError,
  InvalidEmployeeGenderError,
} from '@modules/employees/domain/errors/employee.errors';
import { UpdatePersonalEmployeeDataRequest } from '@modules/employees/presentation/http/update-personal-employee-data.request';
import {
  InvalidNifError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { UpdatePersonalEmployeeDataController } from './update-personal-employee-data.controller';

const VALID_EMPLOYEE_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';

const PERSONAL_FIELD_KEYS = [
  'gender',
  'languages',
  'emergencyContact',
  'nif',
  'address',
] as const;

const makeValidRequest = (
  overrides: UpdatePersonalEmployeeDataRequest = {},
): UpdatePersonalEmployeeDataRequest => ({
  id: VALID_EMPLOYEE_ID,
  actorId: ACTOR_ID,
  gender: 'male',
  ...overrides,
});

const expectExecuteCalledWith = (
  executeSpy: jest.SpyInstance<
    ReturnType<UpdatePersonalEmployeeDataPort['execute']>,
    Parameters<UpdatePersonalEmployeeDataPort['execute']>
  >,
  expected: Record<string, unknown>,
) => {
  expect(executeSpy).toHaveBeenCalledTimes(1);
  const dto = executeSpy.mock.calls[0]![0] as UpdatePersonalEmployeeDataDto;
  expect(dto).toBeInstanceOf(UpdatePersonalEmployeeDataDto);
  expect(dto).toMatchObject(expected);

  for (const field of PERSONAL_FIELD_KEYS) {
    if (!(field in expected)) {
      expect(dto[field]).toBeUndefined();
    }
  }
};

const makeStubs = () => ({
  updatePersonalEmployeeDataStub: {
    execute: jest.fn().mockResolvedValue({ id: VALID_EMPLOYEE_ID }),
  } satisfies UpdatePersonalEmployeeDataPort,
});

const makeSut = (): SutTypes => {
  const { updatePersonalEmployeeDataStub } = makeStubs();
  const sut = new UpdatePersonalEmployeeDataController(
    updatePersonalEmployeeDataStub,
  );
  return { sut, updatePersonalEmployeeDataStub };
};

type SutTypes = {
  sut: UpdatePersonalEmployeeDataController;
  updatePersonalEmployeeDataStub: UpdatePersonalEmployeeDataPort;
};

describe('UpdatePersonalEmployeeDataController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdatePersonalEmployeeDataController);
  });

  it.each([
    ['empty body', {}],
    ['only unknown name', { name: 'X' }],
    [
      'only unknown status and password',
      { status: 'INACTIVE', password: 'secret' },
    ],
  ] as const)(
    'should return 400 when request has %s and not call port',
    async (_label, overrides) => {
      const { sut, updatePersonalEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

      const response = await sut.handle({
        id: VALID_EMPLOYEE_ID,
        actorId: ACTOR_ID,
        ...overrides,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new MissingParamError('no personal-data fields').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it('should call port with actorId, id and gender only', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      gender: 'male',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      gender: 'male',
    });
  });

  it('should forward gender null to clear', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      gender: null,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      gender: null,
    });
  });

  it('should forward empty gender string without converting to null', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      gender: '',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      gender: '',
    });
  });

  it.each([
    ['empty string', { languages: '' }],
    ['whitespace only', { languages: '   ' }],
    ['null', { languages: null }],
  ])('should normalize languages %s to null', async (_label, overrides) => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      ...overrides,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      languages: null,
    });
  });

  it('should forward languages with surrounding spaces unchanged', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      languages: ' Português ',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      languages: ' Português ',
    });
  });

  it.each([
    ['empty string', { address: '' }],
    ['null', { address: null }],
  ])('should normalize address %s to null', async (_label, overrides) => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      ...overrides,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      address: null,
    });
  });

  it('should forward emergencyContact null to clear', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      emergencyContact: null,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      emergencyContact: null,
    });
  });

  it('should forward nif null to clear', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      nif: null,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      nif: null,
    });
  });

  it('should coerce numeric nif to string before calling port', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      nif: 123456789,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      nif: '123456789',
    });
  });

  it('should forward string nif unchanged', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      nif: '123456789',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      nif: '123456789',
    });
  });

  it('should forward stamped actorId and path id from the flattened request', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle(makeValidRequest());

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        id: VALID_EMPLOYEE_ID,
      }),
    );
  });

  it('should ignore unknown keys and forward only personal fields', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updatePersonalEmployeeDataStub, 'execute');

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      gender: 'male',
      status: 'INACTIVE',
    } as UpdatePersonalEmployeeDataRequest);

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      gender: 'male',
    });
  });

  it('should return 401 if port throws ActorAuthenticationFailedError', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(new ActorAuthenticationFailedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication failed' });
  });

  it('should return 403 if port throws EmployeePersonalDataForbiddenError', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeePersonalDataForbiddenError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Action not allowed' });
  });

  it('should return 409 if port throws EmployeeAlreadyRemovedError', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeeAlreadyRemovedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: 'Employee is already removed' });
  });

  it('should return 400 if port throws EmployeeNotFoundError', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeeNotFoundError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Employee not found' });
  });

  it('should return 400 if port throws EmptyPersonalEmployeeDataError', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmptyPersonalEmployeeDataError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'At least one personal data field is required',
    });
  });

  it('should return 400 if port throws InvalidPhoneFormatError', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(
        new InvalidPhoneFormatError('Invalid phone format: empty'),
      );

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid phone format: empty',
    });
  });

  it('should return 400 if port throws InvalidNifError', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(new InvalidNifError('Invalid NIF check digit: "0"'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid NIF check digit: "0"',
    });
  });

  it('should return 400 with Invalid param gender if port throws InvalidEmployeeGenderError', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(new InvalidEmployeeGenderError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param gender' });
  });

  it('should return 500 if port throws an unexpected error', async () => {
    const { sut, updatePersonalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updatePersonalEmployeeDataStub, 'execute')
      .mockRejectedValue(new Error('UpdatePersonalEmployeeDataPort error'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'UpdatePersonalEmployeeDataPort error',
    });
  });

  it('should return 200 when personal data is updated successfully', async () => {
    const { sut } = makeSut();

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: { id: VALID_EMPLOYEE_ID },
    });
  });
});
