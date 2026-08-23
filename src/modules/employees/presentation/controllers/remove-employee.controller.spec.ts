import { RemoveEmployeePort } from '@modules/employees/application/ports/inbound/remove-employee.port';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  EmployeeNotInactiveError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
import { RemoveEmployeeRequest } from '@modules/employees/presentation/http/remove-employee.request';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { RemoveEmployeeController } from './remove-employee.controller';

const VALID_EMPLOYEE_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439022';
const ACTOR_PASSWORD = 'P@ssword123';

const makeValidRequest = (
  overrides: RemoveEmployeeRequest = {},
): RemoveEmployeeRequest => ({
  id: VALID_EMPLOYEE_ID,
  password: ACTOR_PASSWORD,
  actorId: ACTOR_ID,
  ...overrides,
});

const makeStubs = () => ({
  removeEmployeeStub: {
    execute: jest.fn().mockResolvedValue({ id: VALID_EMPLOYEE_ID }),
  } satisfies RemoveEmployeePort,
});

const makeSut = (): SutTypes => {
  const { removeEmployeeStub } = makeStubs();
  const sut = new RemoveEmployeeController(removeEmployeeStub);
  return { sut, removeEmployeeStub };
};

type SutTypes = {
  sut: RemoveEmployeeController;
  removeEmployeeStub: RemoveEmployeePort;
};

describe('RemoveEmployeeController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(RemoveEmployeeController);
  });

  it('should return 400 if id is not provided', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    const removeEmployeeSpy = jest.spyOn(removeEmployeeStub, 'execute');

    const response = await sut.handle(makeValidRequest({ id: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('id').message,
    });
    expect(removeEmployeeSpy).not.toHaveBeenCalled();
  });

  it('should return 400 if password is not provided', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    const removeEmployeeSpy = jest.spyOn(removeEmployeeStub, 'execute');

    const response = await sut.handle(makeValidRequest({ password: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('password').message,
    });
    expect(removeEmployeeSpy).not.toHaveBeenCalled();
  });

  it('should call RemoveEmployeePort with actorId, targetId and actorPassword', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    const removeEmployeeSpy = jest.spyOn(removeEmployeeStub, 'execute');

    await sut.handle(makeValidRequest());

    expect(removeEmployeeSpy).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      targetId: VALID_EMPLOYEE_ID,
      actorPassword: ACTOR_PASSWORD,
    });
  });

  it('should forward empty actorId when the request has none', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    const removeEmployeeSpy = jest.spyOn(removeEmployeeStub, 'execute');

    await sut.handle(makeValidRequest({ actorId: undefined }));

    expect(removeEmployeeSpy).toHaveBeenCalledWith({
      actorId: '',
      targetId: VALID_EMPLOYEE_ID,
      actorPassword: ACTOR_PASSWORD,
    });
  });

  it('should return 200 if employee is removed successfully', async () => {
    const { sut } = makeSut();

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: { id: VALID_EMPLOYEE_ID },
    });
  });

  it('should return 401 if RemoveEmployeePort throws ActorAuthenticationFailedError', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    jest
      .spyOn(removeEmployeeStub, 'execute')
      .mockRejectedValue(new ActorAuthenticationFailedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication failed' });
  });

  it('should return 403 if RemoveEmployeePort throws EmployeeLifecycleForbiddenError', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    jest
      .spyOn(removeEmployeeStub, 'execute')
      .mockRejectedValue(new EmployeeLifecycleForbiddenError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Action not allowed' });
  });

  it('should return 409 if RemoveEmployeePort throws LastAdminProtectedError', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    jest
      .spyOn(removeEmployeeStub, 'execute')
      .mockRejectedValue(new LastAdminProtectedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      error: 'Last Admin must stay ACTIVE until another Admin exists',
    });
  });

  it('should return 409 if RemoveEmployeePort throws EmployeeNotInactiveError', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    jest
      .spyOn(removeEmployeeStub, 'execute')
      .mockRejectedValue(new EmployeeNotInactiveError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: 'Employee is not inactive' });
  });

  it('should return 409 if RemoveEmployeePort throws EmployeeAlreadyRemovedError', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    jest
      .spyOn(removeEmployeeStub, 'execute')
      .mockRejectedValue(new EmployeeAlreadyRemovedError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: 'Employee is already removed' });
  });

  it('should return 400 if RemoveEmployeePort throws EmployeeNotFoundError', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    jest
      .spyOn(removeEmployeeStub, 'execute')
      .mockRejectedValue(new EmployeeNotFoundError());

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Employee not found' });
  });

  it('should return 500 if RemoveEmployeePort throws', async () => {
    const { sut, removeEmployeeStub } = makeSut();
    jest
      .spyOn(removeEmployeeStub, 'execute')
      .mockRejectedValue(new Error('RemoveEmployeePort error'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'RemoveEmployeePort error',
    });
  });
});
