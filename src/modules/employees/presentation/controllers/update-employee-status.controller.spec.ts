import { UpdateEmployeeStatusPort } from '@modules/employees/application/ports/inbound/update-employee-status.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyActiveError,
  EmployeeAlreadyInactiveError,
  EmployeeAlreadyOnVacationError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { UpdateEmployeeStatusRequest } from '@modules/employees/presentation/http/update-employee-status.request';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { UpdateEmployeeStatusController } from './update-employee-status.controller';

const VALID_EMPLOYEE_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';

const makeValidRequest = (
  overrides: UpdateEmployeeStatusRequest = {},
): UpdateEmployeeStatusRequest => ({
  id: VALID_EMPLOYEE_ID,
  status: EmployeeModel.Status.INACTIVE,
  actorId: ACTOR_ID,
  ...overrides,
});

const makeStubs = () => ({
  updateEmployeeStatusStub: {
    execute: jest.fn().mockResolvedValue({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    }),
  } satisfies UpdateEmployeeStatusPort,
});

const makeSut = (): SutTypes => {
  const { updateEmployeeStatusStub } = makeStubs();
  const sut = new UpdateEmployeeStatusController(updateEmployeeStatusStub);
  return { sut, updateEmployeeStatusStub };
};

type SutTypes = {
  sut: UpdateEmployeeStatusController;
  updateEmployeeStatusStub: UpdateEmployeeStatusPort;
};

describe('UpdateEmployeeStatusController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateEmployeeStatusController);
  });

  it('should return 400 if id is not provided', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    const response = await sut.handle(makeValidRequest({ id: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('id').message,
    });
    expect(updateEmployeeStatusSpy).not.toHaveBeenCalled();
  });

  it('should return 400 if status is not provided', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    const response = await sut.handle(makeValidRequest({ status: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('status').message,
    });
    expect(updateEmployeeStatusSpy).not.toHaveBeenCalled();
  });

  it('should return 400 when status is REMOVED', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    const response = await sut.handle(
      makeValidRequest({ status: EmployeeModel.Status.REMOVED }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param status' });
    expect(updateEmployeeStatusSpy).not.toHaveBeenCalled();
  });

  it('should return 400 when status is invalid', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    const response = await sut.handle(makeValidRequest({ status: 'active' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param status' });
    expect(updateEmployeeStatusSpy).not.toHaveBeenCalled();
  });

  it.each(EmployeeModel.OPERATIONAL_STATUSES)(
    'should accept %s as a valid status and forward actorId',
    async (status) => {
      const { sut, updateEmployeeStatusStub } = makeSut();
      const updateEmployeeStatusSpy = jest.spyOn(
        updateEmployeeStatusStub,
        'execute',
      );

      await sut.handle(makeValidRequest({ status }));

      expect(updateEmployeeStatusSpy).toHaveBeenCalledWith({
        actorId: ACTOR_ID,
        id: VALID_EMPLOYEE_ID,
        status,
      });
    },
  );

  it('should call UpdateEmployeeStatusPort with actorId, id and status', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const request = makeValidRequest();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    await sut.handle(request);

    expect(updateEmployeeStatusSpy).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
  });

  it('should forward empty actorId when the request has none', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    await sut.handle(makeValidRequest({ actorId: undefined }));

    expect(updateEmployeeStatusSpy).toHaveBeenCalledWith({
      actorId: '',
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
  });

  it('should return 401 if UpdateEmployeeStatusPort throws ActorAuthenticationFailedError', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    jest
      .spyOn(updateEmployeeStatusStub, 'execute')
      .mockRejectedValue(new ActorAuthenticationFailedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication failed' });
  });

  it('should return 403 if UpdateEmployeeStatusPort throws EmployeeLifecycleForbiddenError', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    jest
      .spyOn(updateEmployeeStatusStub, 'execute')
      .mockRejectedValue(new EmployeeLifecycleForbiddenError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Action not allowed' });
  });

  it('should return 409 if UpdateEmployeeStatusPort throws LastAdminProtectedError', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    jest
      .spyOn(updateEmployeeStatusStub, 'execute')
      .mockRejectedValue(new LastAdminProtectedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: 'Last Admin must stay ACTIVE until another Admin exists',
    });
  });

  it('should return 409 if UpdateEmployeeStatusPort throws EmployeeAlreadyRemovedError', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    jest
      .spyOn(updateEmployeeStatusStub, 'execute')
      .mockRejectedValue(new EmployeeAlreadyRemovedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: 'Employee is already removed' });
  });

  it('should return 400 if UpdateEmployeeStatusPort throws EmployeeNotFoundError', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    jest
      .spyOn(updateEmployeeStatusStub, 'execute')
      .mockRejectedValue(new EmployeeNotFoundError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Employee not found' });
  });

  it.each([
    [new EmployeeAlreadyActiveError(), 'Employee is already active'],
    [new EmployeeAlreadyInactiveError(), 'Employee is already inactive'],
    [new EmployeeAlreadyOnVacationError(), 'Employee is already on vacation'],
  ])(
    'should return 400 if UpdateEmployeeStatusPort throws %s',
    async (error, message) => {
      const { sut, updateEmployeeStatusStub } = makeSut();
      jest.spyOn(updateEmployeeStatusStub, 'execute').mockRejectedValue(error);

      const response = await sut.handle(makeValidRequest());

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: message });
    },
  );

  it('should return 500 if UpdateEmployeeStatusPort throws', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    jest
      .spyOn(updateEmployeeStatusStub, 'execute')
      .mockRejectedValue(new Error('UpdateEmployeeStatusPort error'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'UpdateEmployeeStatusPort error',
    });
  });

  it('should return 200 if employee status is updated successfully', async () => {
    const { sut } = makeSut();

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: VALID_EMPLOYEE_ID,
        status: EmployeeModel.Status.INACTIVE,
      },
    });
  });
});
