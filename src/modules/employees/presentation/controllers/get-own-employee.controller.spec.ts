import { GetEmployeesItemDto } from '@modules/employees/application/dtos/get-employees.dto';
import { GetOwnEmployeePort } from '@modules/employees/application/ports/inbound/get-own-employee.port';
import { ActorAuthenticationFailedError } from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { GetOwnEmployeeController } from './get-own-employee.controller';

const ACTOR_ID = '507f1f77bcf86cd799439022';

const makeReadModel = (): GetEmployeesItemDto => ({
  id: ACTOR_ID,
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: EmployeeModel.Role.EMPLOYEE,
  phone: '351900000000',
  nif: '123456789',
  status: EmployeeModel.Status.ACTIVE,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  deactivateAt: null,
  username: 'john.doe',
  gender: 'male',
  address: 'Rua do Grau, 1',
  languages: 'pt,en',
  emergencyContact: '351912000001',
  employmentId: 'EMP-001',
  jobTitle: 'Bartender',
});

const makeStubs = () => ({
  getOwnEmployeeStub: {
    execute: jest.fn().mockResolvedValue(makeReadModel()),
  } satisfies GetOwnEmployeePort,
});

const makeSut = () => {
  const { getOwnEmployeeStub } = makeStubs();
  const sut = new GetOwnEmployeeController(getOwnEmployeeStub);
  return { sut, getOwnEmployeeStub };
};

describe('GetOwnEmployeeController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetOwnEmployeeController);
  });

  it('should forward the stamped actorId', async () => {
    const { sut, getOwnEmployeeStub } = makeSut();
    const executeSpy = jest.spyOn(getOwnEmployeeStub, 'execute');

    await sut.handle({ actorId: ACTOR_ID, actorRole: 'EMPLOYEE' });

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith({ actorId: ACTOR_ID });
  });

  it('should forward an empty actorId when the stamp is missing', async () => {
    const { sut, getOwnEmployeeStub } = makeSut();
    const executeSpy = jest.spyOn(getOwnEmployeeStub, 'execute');

    const response = await sut.handle({});

    expect(executeSpy).toHaveBeenCalledWith({ actorId: '' });
    expect(response.body).not.toEqual({
      error: expect.stringMatching(/Missing param/),
    });
  });

  it('should return 401 if port throws ActorAuthenticationFailedError', async () => {
    const { sut, getOwnEmployeeStub } = makeSut();
    jest
      .spyOn(getOwnEmployeeStub, 'execute')
      .mockRejectedValue(new ActorAuthenticationFailedError());

    const response = await sut.handle({ actorId: ACTOR_ID });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication failed' });
  });

  it('should return 500 if port throws an unexpected error', async () => {
    const { sut, getOwnEmployeeStub } = makeSut();
    jest
      .spyOn(getOwnEmployeeStub, 'execute')
      .mockRejectedValue(new Error('GetOwnEmployeePort error'));

    const response = await sut.handle({ actorId: ACTOR_ID });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'GetOwnEmployeePort error' });
  });

  it('should return 200 with the read model and without password', async () => {
    const { sut } = makeSut();
    const readModel = makeReadModel();

    const response = await sut.handle({ actorId: ACTOR_ID });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: readModel });
    expect(response.body).not.toEqual({ data: { id: readModel.id } });

    if ('data' in response.body) {
      expect('password' in response.body.data).toBe(false);
    }
  });
});
