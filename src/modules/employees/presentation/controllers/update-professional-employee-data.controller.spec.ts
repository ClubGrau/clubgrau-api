import { UpdateProfessionalEmployeeDataDto } from '@modules/employees/application/dtos/update-professional-employee-data.dto';
import { UpdateProfessionalEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-professional-employee-data.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyActiveError,
  EmployeeAlreadyInactiveError,
  EmployeeAlreadyOnVacationError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  EmployeeProfessionalDataForbiddenError,
  EmptyProfessionalEmployeeDataError,
  InvalidEmployeeRoleError,
  InvalidEmployeeStatusError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
import { UpdateProfessionalEmployeeDataRequest } from '@modules/employees/presentation/http/update-professional-employee-data.request';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { UpdateProfessionalEmployeeDataController } from './update-professional-employee-data.controller';

const VALID_EMPLOYEE_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';

const COMMAND_FIELD_KEYS = ['jobTitle', 'role', 'status'] as const;

const makeValidRequest = (
  overrides: UpdateProfessionalEmployeeDataRequest = {},
): UpdateProfessionalEmployeeDataRequest => ({
  id: VALID_EMPLOYEE_ID,
  actorId: ACTOR_ID,
  jobTitle: 'Barbeiro',
  ...overrides,
});

const expectExecuteCalledWith = (
  executeSpy: jest.SpyInstance<
    ReturnType<UpdateProfessionalEmployeeDataPort['execute']>,
    Parameters<UpdateProfessionalEmployeeDataPort['execute']>
  >,
  expected: Record<string, unknown>,
) => {
  expect(executeSpy).toHaveBeenCalledTimes(1);
  const dto = executeSpy.mock.calls[0]![0] as UpdateProfessionalEmployeeDataDto;
  expect(dto).toBeInstanceOf(UpdateProfessionalEmployeeDataDto);
  expect(dto).toMatchObject(expected);

  for (const field of COMMAND_FIELD_KEYS) {
    if (!(field in expected)) {
      expect(dto[field]).toBeUndefined();
    }
  }
};

const makeStubs = () => ({
  updateProfessionalEmployeeDataStub: {
    execute: jest.fn().mockResolvedValue({ id: VALID_EMPLOYEE_ID }),
  } satisfies UpdateProfessionalEmployeeDataPort,
});

const makeSut = (): SutTypes => {
  const { updateProfessionalEmployeeDataStub } = makeStubs();
  const sut = new UpdateProfessionalEmployeeDataController(
    updateProfessionalEmployeeDataStub,
  );
  return { sut, updateProfessionalEmployeeDataStub };
};

type SutTypes = {
  sut: UpdateProfessionalEmployeeDataController;
  updateProfessionalEmployeeDataStub: UpdateProfessionalEmployeeDataPort;
};

describe('UpdateProfessionalEmployeeDataController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateProfessionalEmployeeDataController);
  });

  it.each([
    ['empty body', {}],
    ['only unknown name', { name: 'X' }],
    ['only employmentId', { employmentId: 'M-1' }],
  ] as const)(
    'should return 400 when request has %s and not call port',
    async (_label, overrides) => {
      const { sut, updateProfessionalEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(
        updateProfessionalEmployeeDataStub,
        'execute',
      );

      const response = await sut.handle({
        id: VALID_EMPLOYEE_ID,
        actorId: ACTOR_ID,
        ...overrides,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new MissingParamError('no professional-data fields').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a string', { password: 'secret' }],
    ['null', { password: null }],
  ] as const)(
    'should return 400 Invalid param password when password is %s and not call port',
    async (_label, overrides) => {
      const { sut, updateProfessionalEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(
        updateProfessionalEmployeeDataStub,
        'execute',
      );

      const response = await sut.handle({
        id: VALID_EMPLOYEE_ID,
        actorId: ACTOR_ID,
        ...overrides,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new InvalidParamError('password').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it('should call port with actorId, id and jobTitle only', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(
      updateProfessionalEmployeeDataStub,
      'execute',
    );

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      jobTitle: 'Barbeiro',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      jobTitle: 'Barbeiro',
    });
  });

  it.each([
    ['null', { jobTitle: null }],
    ['empty string', { jobTitle: '' }],
    ['whitespace only', { jobTitle: '   ' }],
  ] as const)(
    'should normalize jobTitle %s to null',
    async (_label, overrides) => {
      const { sut, updateProfessionalEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(
        updateProfessionalEmployeeDataStub,
        'execute',
      );

      await sut.handle({
        id: VALID_EMPLOYEE_ID,
        actorId: ACTOR_ID,
        ...overrides,
      });

      expectExecuteCalledWith(executeSpy, {
        actorId: ACTOR_ID,
        id: VALID_EMPLOYEE_ID,
        jobTitle: null,
      });
    },
  );

  it('should forward jobTitle with surrounding spaces unchanged', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(
      updateProfessionalEmployeeDataStub,
      'execute',
    );

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      jobTitle: ' Barbeiro ',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      jobTitle: ' Barbeiro ',
    });
  });

  it.each([
    ['null', { role: null }],
    ['empty string', { role: '' }],
    ['whitespace only', { role: '   ' }],
  ] as const)(
    'should return 400 when role is %s and not call port',
    async (_label, overrides) => {
      const { sut, updateProfessionalEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(
        updateProfessionalEmployeeDataStub,
        'execute',
      );

      const response = await sut.handle({
        id: VALID_EMPLOYEE_ID,
        actorId: ACTOR_ID,
        ...overrides,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new InvalidParamError('role').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['null', { status: null }],
    ['empty string', { status: '' }],
    ['whitespace only', { status: '   ' }],
  ] as const)(
    'should return 400 when status is %s and not call port',
    async (_label, overrides) => {
      const { sut, updateProfessionalEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(
        updateProfessionalEmployeeDataStub,
        'execute',
      );

      const response = await sut.handle({
        id: VALID_EMPLOYEE_ID,
        actorId: ACTOR_ID,
        ...overrides,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new InvalidParamError('status').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it('should forward role when present as a non-empty string', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(
      updateProfessionalEmployeeDataStub,
      'execute',
    );

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      role: 'MANAGER',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      role: 'MANAGER',
    });
  });

  it('should forward status when present as a non-empty string', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(
      updateProfessionalEmployeeDataStub,
      'execute',
    );

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      status: 'INACTIVE',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      status: 'INACTIVE',
    });
  });

  it('should forward jobTitle, role and status together', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(
      updateProfessionalEmployeeDataStub,
      'execute',
    );

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      jobTitle: 'Barbeiro',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      jobTitle: 'Barbeiro',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    });
  });

  it('should ignore employmentId and unknown keys and forward only jobTitle', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(
      updateProfessionalEmployeeDataStub,
      'execute',
    );

    await sut.handle({
      id: VALID_EMPLOYEE_ID,
      actorId: ACTOR_ID,
      jobTitle: 'Barbeiro',
      employmentId: 'M-1',
      name: 'X',
    } as UpdateProfessionalEmployeeDataRequest);

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      jobTitle: 'Barbeiro',
    });
  });

  it('should forward stamped actorId and path id from the flattened request', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(
      updateProfessionalEmployeeDataStub,
      'execute',
    );

    await sut.handle(makeValidRequest());

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      jobTitle: 'Barbeiro',
    });
  });

  it('should return 401 if port throws ActorAuthenticationFailedError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new ActorAuthenticationFailedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication failed' });
  });

  it('should return 403 if port throws EmployeeProfessionalDataForbiddenError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeeProfessionalDataForbiddenError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Action not allowed' });
  });

  it('should return 403 if port throws EmployeeLifecycleForbiddenError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeeLifecycleForbiddenError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Action not allowed' });
  });

  it('should return 409 if port throws LastAdminProtectedError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new LastAdminProtectedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: 'Last Admin must stay ACTIVE until another Admin exists',
    });
  });

  it('should return 409 if port throws EmployeeAlreadyRemovedError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeeAlreadyRemovedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: 'Employee is already removed' });
  });

  it('should return 400 if port throws EmployeeNotFoundError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmployeeNotFoundError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Employee not found' });
  });

  it('should return 400 if port throws EmptyProfessionalEmployeeDataError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new EmptyProfessionalEmployeeDataError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'At least one professional data field is required',
    });
  });

  it('should return 400 if port throws InvalidEmployeeRoleError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new InvalidEmployeeRoleError('Invalid role: "OWNER"'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid role: "OWNER"' });
  });

  it('should return 400 if port throws InvalidEmployeeStatusError', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(
        new InvalidEmployeeStatusError('Invalid status: "REMOVED"'),
      );

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid status: "REMOVED"' });
  });

  it.each([
    new EmployeeAlreadyActiveError(),
    new EmployeeAlreadyInactiveError(),
    new EmployeeAlreadyOnVacationError(),
  ])(
    'should return 500 if port throws already-in-status error %s',
    async (error) => {
      const { sut, updateProfessionalEmployeeDataStub } = makeSut();
      jest
        .spyOn(updateProfessionalEmployeeDataStub, 'execute')
        .mockRejectedValue(error);

      const response = await sut.handle(makeValidRequest());

      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({ error: error.message });
    },
  );

  it('should return 500 if port throws an unexpected error', async () => {
    const { sut, updateProfessionalEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateProfessionalEmployeeDataStub, 'execute')
      .mockRejectedValue(new Error('UpdateProfessionalEmployeeDataPort error'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'UpdateProfessionalEmployeeDataPort error',
    });
  });

  it('should return 200 when professional data is updated successfully', async () => {
    const { sut } = makeSut();

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: { id: VALID_EMPLOYEE_ID },
    });
  });
});
