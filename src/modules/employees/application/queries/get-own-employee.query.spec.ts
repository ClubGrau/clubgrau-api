import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeNotFoundError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeOwnDataPolicy } from '@modules/employees/domain/services/employee-own-data.policy';
import { GetEmployeesItemDto } from '../dtos/get-employees.dto';
import { FindOwnEmployeePort } from '../ports/outbound/find-own-employee.port';
import { GetOwnEmployeeQuery } from './get-own-employee.query';

const ACTOR_ID = '507f1f77bcf86cd799439022';

const makeReadModel = (
  overrides: Partial<GetEmployeesItemDto> = {},
): GetEmployeesItemDto => ({
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
  ...overrides,
});

const makeStubs = (readModel: GetEmployeesItemDto | null = makeReadModel()) => {
  const findOwnEmployeeStub: FindOwnEmployeePort = {
    findOwnEmployee: jest.fn().mockResolvedValue(readModel),
  };

  return { findOwnEmployeeStub, readModel };
};

type SutTypes = {
  sut: GetOwnEmployeeQuery;
  findOwnEmployeeStub: FindOwnEmployeePort;
  ownDataPolicy: EmployeeOwnDataPolicy;
  readModel: GetEmployeesItemDto | null;
};

const makeSut = (
  readModel: GetEmployeesItemDto | null = makeReadModel(),
): SutTypes => {
  const { findOwnEmployeeStub } = makeStubs(readModel);
  const ownDataPolicy = new EmployeeOwnDataPolicy();
  const sut = new GetOwnEmployeeQuery(findOwnEmployeeStub, ownDataPolicy);

  return {
    sut,
    findOwnEmployeeStub,
    ownDataPolicy,
    readModel,
  };
};

describe('GetOwnEmployeeQuery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetOwnEmployeeQuery);
  });

  it('should throw ActorAuthenticationFailedError when actorId is missing or blank', async () => {
    const { sut, findOwnEmployeeStub } = makeSut();

    await expect(sut.execute({ actorId: '' })).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    await expect(sut.execute({ actorId: '   ' })).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );

    expect(findOwnEmployeeStub.findOwnEmployee).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when findOwnEmployee returns null without calling assertCan', async () => {
    const { sut, ownDataPolicy } = makeSut(null);
    const assertCanSpy = jest.spyOn(ownDataPolicy, 'assertCan');

    const error = await sut
      .execute({ actorId: ACTOR_ID })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ActorAuthenticationFailedError);
    expect(error).not.toBeInstanceOf(EmployeeNotFoundError);
    expect(assertCanSpy).not.toHaveBeenCalled();
  });

  it('should call FindOwnEmployeePort.findOwnEmployee with actorId', async () => {
    const { sut, findOwnEmployeeStub } = makeSut();

    await sut.execute({ actorId: ACTOR_ID });

    expect(findOwnEmployeeStub.findOwnEmployee).toHaveBeenCalledTimes(1);
    expect(findOwnEmployeeStub.findOwnEmployee).toHaveBeenCalledWith(ACTOR_ID);
  });

  it('should return the same read model when status is ACTIVE and assertCan saw ACTIVE', async () => {
    const readModel = makeReadModel({ status: EmployeeModel.Status.ACTIVE });
    const { sut, ownDataPolicy } = makeSut(readModel);
    const assertCanSpy = jest.spyOn(ownDataPolicy, 'assertCan');

    const result = await sut.execute({ actorId: ACTOR_ID });

    expect(result).toBe(readModel);
    expect(assertCanSpy).toHaveBeenCalledTimes(1);
    expect(assertCanSpy).toHaveBeenCalledWith(EmployeeModel.Status.ACTIVE);
  });

  it('should return the read model when status is VACATION', async () => {
    const readModel = makeReadModel({ status: EmployeeModel.Status.VACATION });
    const { sut } = makeSut(readModel);

    const result = await sut.execute({ actorId: ACTOR_ID });

    expect(result).toBe(readModel);
  });

  it('should throw ActorAuthenticationFailedError when status is INACTIVE', async () => {
    const readModel = makeReadModel({ status: EmployeeModel.Status.INACTIVE });
    const { sut, ownDataPolicy } = makeSut(readModel);
    const assertCanSpy = jest.spyOn(ownDataPolicy, 'assertCan');

    await expect(sut.execute({ actorId: ACTOR_ID })).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    expect(assertCanSpy).toHaveBeenCalledWith(EmployeeModel.Status.INACTIVE);
  });

  it('should throw ActorAuthenticationFailedError when status is REMOVED', async () => {
    const readModel = makeReadModel({ status: EmployeeModel.Status.REMOVED });
    const { sut } = makeSut(readModel);

    const error = await sut
      .execute({ actorId: ACTOR_ID })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ActorAuthenticationFailedError);
    expect(error).not.toBeInstanceOf(EmployeeAlreadyRemovedError);
  });

  it('should return the stubbed read model without a password key', async () => {
    const readModel = makeReadModel();
    const { sut } = makeSut(readModel);

    const result = await sut.execute({ actorId: ACTOR_ID });

    expect(result).toEqual(readModel);
    expect('password' in result).toBe(false);
  });

  it.each([
    EmployeeModel.Role.EMPLOYEE,
    EmployeeModel.Role.MANAGER,
    EmployeeModel.Role.ADMIN,
  ])(
    'should return the read model when role is %s and status is ACTIVE',
    async (role) => {
      const readModel = makeReadModel({
        role,
        status: EmployeeModel.Status.ACTIVE,
      });
      const { sut } = makeSut(readModel);

      const result = await sut.execute({ actorId: ACTOR_ID });

      expect(result).toBe(readModel);
      expect(result.role).toBe(role);
    },
  );

  it('should depend only on FindOwnEmployeePort and EmployeeOwnDataPolicy', () => {
    expect(GetOwnEmployeeQuery.length).toBe(2);
  });
});
