import { GetEmployeesItemDto } from '@modules/employees/application/dtos/get-employees.dto';
import { UpdateOwnEmployeeDataDto } from '@modules/employees/application/dtos/update-own-employee-data.dto';
import { UpdateOwnEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-own-employee-data.port';
import {
  ActorAuthenticationFailedError,
  EmptyOwnEmployeeDataError,
  InvalidEmployeeGenderError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { UpdateOwnEmployeeDataRequest } from '@modules/employees/presentation/http/update-own-employee-data.request';
import {
  InvalidNameError,
  InvalidNifError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { UpdateOwnEmployeeDataController } from './update-own-employee-data.controller';

const ACTOR_ID = '507f1f77bcf86cd799439022';

const WRITABLE_KEYS = [
  'name',
  'phone',
  'username',
  'gender',
  'languages',
  'emergencyContact',
  'nif',
  'address',
] as const;

const makeReadModel = (): GetEmployeesItemDto => ({
  id: ACTOR_ID,
  name: 'João Silva',
  email: 'joao.silva@example.com',
  role: EmployeeModel.Role.EMPLOYEE,
  phone: '+351 912 345 678',
  nif: '123456789',
  status: EmployeeModel.Status.ACTIVE,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  deactivateAt: null,
  username: 'joao',
  gender: 'male',
  address: 'Rua do Grau, 10, Lisboa',
  languages: 'Português',
  emergencyContact: '+351 912 345 678',
  employmentId: 'EMP-001',
  jobTitle: 'Barbeiro',
});

const expectExecuteCalledWith = (
  executeSpy: jest.SpyInstance<
    ReturnType<UpdateOwnEmployeeDataPort['execute']>,
    Parameters<UpdateOwnEmployeeDataPort['execute']>
  >,
  expected: Record<string, unknown>,
) => {
  expect(executeSpy).toHaveBeenCalledTimes(1);
  const dto = executeSpy.mock.calls[0]![0] as UpdateOwnEmployeeDataDto;
  expect(dto).toBeInstanceOf(UpdateOwnEmployeeDataDto);
  expect(dto).toMatchObject(expected);
  expect((dto as { id?: string }).id).toBeUndefined();

  for (const field of WRITABLE_KEYS) {
    if (!(field in expected)) {
      expect(dto[field]).toBeUndefined();
    }
  }
};

const makeStubs = () => ({
  updateOwnEmployeeDataStub: {
    execute: jest.fn().mockResolvedValue(makeReadModel()),
  } satisfies UpdateOwnEmployeeDataPort,
});

const makeSut = (): SutTypes => {
  const { updateOwnEmployeeDataStub } = makeStubs();
  const sut = new UpdateOwnEmployeeDataController(updateOwnEmployeeDataStub);
  return { sut, updateOwnEmployeeDataStub };
};

type SutTypes = {
  sut: UpdateOwnEmployeeDataController;
  updateOwnEmployeeDataStub: UpdateOwnEmployeeDataPort;
};

describe('UpdateOwnEmployeeDataController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateOwnEmployeeDataController);
  });

  it.each([
    ['empty body', { actorId: ACTOR_ID, actorRole: 'EMPLOYEE' }],
    ['only email', { actorId: ACTOR_ID, email: 'other@example.com' }],
    [
      'only status, password and role',
      {
        actorId: ACTOR_ID,
        status: 'INACTIVE',
        password: 'secret',
        role: 'ADMIN',
      },
    ],
    ['only id', { actorId: ACTOR_ID, id: 'other' }],
  ] as const)(
    'should return 400 when request has %s and not call port',
    async (_label, request) => {
      const { sut, updateOwnEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

      const response = await sut.handle(
        request as UpdateOwnEmployeeDataRequest,
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new MissingParamError('no own-employee-data fields').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['null', null],
  ])(
    'should return 400 when name is %s and not call port',
    async (_label, name) => {
      const { sut, updateOwnEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

      const response = await sut.handle({
        actorId: ACTOR_ID,
        name,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new InvalidParamError('name').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['null', null],
  ])(
    'should return 400 when phone is %s and not call port',
    async (_label, phone) => {
      const { sut, updateOwnEmployeeDataStub } = makeSut();
      const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

      const response = await sut.handle({
        actorId: ACTOR_ID,
        phone,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: new InvalidParamError('phone').message,
      });
      expect(executeSpy).not.toHaveBeenCalled();
    },
  );

  it('should call port with actorId and name only', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      name: 'João Silva',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      name: 'João Silva',
    });
  });

  it('should call port with actorId and phone only', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      phone: '+351 912 345 678',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      phone: '+351 912 345 678',
    });
  });

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['null', null],
  ])('should normalize username %s to null', async (_label, username) => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      username,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      username: null,
    });
  });

  it('should forward a non-blank username unchanged', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      username: 'joao',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      username: 'joao',
    });
  });

  it.each([
    ['empty string', ''],
    ['null', null],
    ['whitespace only', '   '],
  ])('should normalize gender %s to null', async (_label, gender) => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      gender,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      gender: null,
    });
  });

  it('should forward gender invalid so the domain can reject it', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      gender: 'invalid',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      gender: 'invalid',
    });
  });

  it.each([
    ['empty string', ''],
    ['null', null],
  ])('should normalize languages %s to null', async (_label, languages) => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      languages,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      languages: null,
    });
  });

  it('should forward languages with surrounding spaces unchanged', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      languages: ' Português ',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      languages: ' Português ',
    });
  });

  it.each([
    ['address', { address: '' }],
    ['emergencyContact', { emergencyContact: '' }],
  ] as const)('should normalize blank %s to null', async (field, overrides) => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      ...overrides,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      [field]: null,
    });
  });

  it.each([
    ['null', null],
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('should normalize nif %s to null', async (_label, nif) => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      nif,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      nif: null,
    });
  });

  it('should stringify a numeric nif before forwarding', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      nif: 123456789,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      nif: '123456789',
    });
  });

  it('should stringify nif 0 before the blank check', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      nif: 0,
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      nif: '0',
    });
  });

  it('should ignore email and forward address only', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      email: 'other@example.com',
      address: 'Rua B',
    } as UpdateOwnEmployeeDataRequest);

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      address: 'Rua B',
    });
  });

  it('should ignore status and password and forward name only', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      name: 'João Silva',
      status: 'INACTIVE',
      password: 'secret',
    } as UpdateOwnEmployeeDataRequest);

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      name: 'João Silva',
    });
  });

  it('should forward the stamped actorId and omit a forged id', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    const executeSpy = jest.spyOn(updateOwnEmployeeDataStub, 'execute');

    await sut.handle({
      actorId: ACTOR_ID,
      id: 'forged-target',
      name: 'João Silva',
    });

    expectExecuteCalledWith(executeSpy, {
      actorId: ACTOR_ID,
      name: 'João Silva',
    });
  });

  it('should return 401 if port throws ActorAuthenticationFailedError', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateOwnEmployeeDataStub, 'execute')
      .mockRejectedValue(new ActorAuthenticationFailedError());

    const response = await sut.handle({
      actorId: ACTOR_ID,
      name: 'João Silva',
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication failed' });
  });

  it.each([
    ['EmptyOwnEmployeeDataError', new EmptyOwnEmployeeDataError()],
    ['InvalidNameError', new InvalidNameError('Name is required')],
    [
      'InvalidPhoneFormatError',
      new InvalidPhoneFormatError('Invalid phone format: empty'),
    ],
    ['InvalidNifError', new InvalidNifError('Invalid NIF check digit: "0"')],
    ['InvalidEmployeeGenderError', new InvalidEmployeeGenderError()],
  ] as const)('should return 400 if port throws %s', async (_label, error) => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    jest.spyOn(updateOwnEmployeeDataStub, 'execute').mockRejectedValue(error);

    const response = await sut.handle({
      actorId: ACTOR_ID,
      name: 'João Silva',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: error.message });
  });

  it('should return 500 if port throws an unexpected error', async () => {
    const { sut, updateOwnEmployeeDataStub } = makeSut();
    jest
      .spyOn(updateOwnEmployeeDataStub, 'execute')
      .mockRejectedValue(new Error('UpdateOwnEmployeeDataPort error'));

    const response = await sut.handle({
      actorId: ACTOR_ID,
      name: 'João Silva',
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'UpdateOwnEmployeeDataPort error',
    });
  });

  it('should return 200 with the read model from the port', async () => {
    const { sut } = makeSut();
    const readModel = makeReadModel();

    const response = await sut.handle({
      actorId: ACTOR_ID,
      phone: '+351 912 345 678',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: readModel });
    expect(response.body).not.toEqual({ data: { id: readModel.id } });
  });
});
