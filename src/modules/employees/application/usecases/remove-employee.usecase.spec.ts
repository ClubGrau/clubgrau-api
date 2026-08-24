import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  EmployeeNotInactiveError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeLifecyclePolicy } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import { Password } from '@shared/domain/value-object';
import { RemoveEmployeeDto } from '../dtos/remove-employee.dto';
import { AnonymizeEmployeeRepositoryPort } from '../ports/outbound/anonymize-employee-repository.port';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { RemoveEmployeeUsecase } from './remove-employee.usecase';

const ACTOR_ID = '507f1f77bcf86cd799439022';
const TARGET_ID = '507f1f77bcf86cd799439011';
const ACTOR_PASSWORD = 'P@ssword123';
const ACTOR_HASH = '$2b$10$abcdefghijklmnopqrstuv';
const TARGET_HASH = '$2b$10$targetoldpasswordhashxx';
const HASHED_RANDOM = 'hashed-random';

const makeSnapshot = (
  overrides: Partial<EmployeeModel.toCreate> = {},
): EmployeeModel.toCreate => ({
  id: TARGET_ID,
  name: 'John Doe',
  email: 'john.doe@example.com',
  password: TARGET_HASH,
  role: EmployeeModel.Role.EMPLOYEE,
  phone: '+351 912 345 678',
  nif: '123456789',
  status: EmployeeModel.Status.INACTIVE,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  deactivateAt: new Date('2024-06-01T00:00:00.000Z'),
  removedAt: null,
  ...overrides,
});

const makeActorSnapshot = (
  overrides: Partial<EmployeeModel.toCreate> = {},
): EmployeeModel.toCreate =>
  makeSnapshot({
    id: ACTOR_ID,
    name: 'Admin Actor',
    email: 'admin.actor@example.com',
    password: ACTOR_HASH,
    role: EmployeeModel.Role.ADMIN,
    status: EmployeeModel.Status.ACTIVE,
    phone: null,
    nif: null,
    deactivateAt: null,
    ...overrides,
  });

type LifecyclePolicyStub = {
  assertCan: jest.MockedFunction<EmployeeLifecyclePolicy['assertCan']>;
};

const makeStubs = (
  actor: EmployeeModel.toCreate | null = makeActorSnapshot(),
  target: EmployeeModel.toCreate | null = makeSnapshot(),
) => {
  const findEmployeeByIdStub: FindEmployeeByIdPort = {
    findById: jest.fn(async (id: string) => {
      if (actor && id === actor.id) {
        return actor;
      }
      if (target && id === target.id) {
        return target;
      }
      return null;
    }),
  };
  const compareHashStub: CompareHashPort = {
    compare: jest.fn().mockResolvedValue(true),
  };
  const encrypterStub: EncrypterPort = {
    encrypt: jest.fn().mockResolvedValue(HASHED_RANDOM),
  };
  const lifecyclePolicyStub: LifecyclePolicyStub = {
    assertCan: jest.fn().mockResolvedValue(undefined),
  };
  const anonymizeEmployeeStub: AnonymizeEmployeeRepositoryPort = {
    anonymize: jest.fn().mockResolvedValue(undefined),
  };

  return {
    findEmployeeByIdStub,
    compareHashStub,
    encrypterStub,
    lifecyclePolicyStub,
    anonymizeEmployeeStub,
  };
};

const makeSut = (
  actor: EmployeeModel.toCreate | null = makeActorSnapshot(),
  target: EmployeeModel.toCreate | null = makeSnapshot(),
): SutTypes => {
  const {
    findEmployeeByIdStub,
    compareHashStub,
    encrypterStub,
    lifecyclePolicyStub,
    anonymizeEmployeeStub,
  } = makeStubs(actor, target);
  const sut = new RemoveEmployeeUsecase(
    findEmployeeByIdStub,
    compareHashStub,
    encrypterStub,
    lifecyclePolicyStub as unknown as EmployeeLifecyclePolicy,
    anonymizeEmployeeStub,
  );
  return {
    sut,
    findEmployeeByIdStub,
    compareHashStub,
    encrypterStub,
    lifecyclePolicyStub,
    anonymizeEmployeeStub,
  };
};

const makeParams = (
  overrides: Partial<RemoveEmployeeDto> = {},
): RemoveEmployeeDto => ({
  actorId: ACTOR_ID,
  targetId: TARGET_ID,
  actorPassword: ACTOR_PASSWORD,
  ...overrides,
});

type SutTypes = {
  sut: RemoveEmployeeUsecase;
  findEmployeeByIdStub: FindEmployeeByIdPort;
  compareHashStub: CompareHashPort;
  encrypterStub: EncrypterPort;
  lifecyclePolicyStub: LifecyclePolicyStub;
  anonymizeEmployeeStub: AnonymizeEmployeeRepositoryPort;
};

describe('RemoveEmployeeUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(RemoveEmployeeUsecase);
  });

  it('should throw ActorAuthenticationFailedError when actorId is missing', async () => {
    const { sut, anonymizeEmployeeStub, findEmployeeByIdStub } = makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when actorId is blank', async () => {
    const { sut, anonymizeEmployeeStub, findEmployeeByIdStub } = makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '   ' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when Actor findById returns null', async () => {
    const {
      sut,
      anonymizeEmployeeStub,
      findEmployeeByIdStub,
      compareHashStub,
    } = makeSut(null, makeSnapshot());

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledTimes(1);
    expect(compareHashStub.compare).not.toHaveBeenCalled();
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when compare returns false and not load Target', async () => {
    const {
      sut,
      compareHashStub,
      findEmployeeByIdStub,
      anonymizeEmployeeStub,
    } = makeSut();
    jest.spyOn(compareHashStub, 'compare').mockResolvedValueOnce(false);

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    expect(compareHashStub.compare).toHaveBeenCalledWith(
      ACTOR_PASSWORD,
      ACTOR_HASH,
    );
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledTimes(1);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when compare throws', async () => {
    const { sut, compareHashStub, anonymizeEmployeeStub } = makeSut();
    jest
      .spyOn(compareHashStub, 'compare')
      .mockRejectedValueOnce(new Error('bcrypt exploded'));

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should throw EmployeeNotFoundError when Target findById returns null after successful compare', async () => {
    const {
      sut,
      anonymizeEmployeeStub,
      findEmployeeByIdStub,
      compareHashStub,
    } = makeSut(makeActorSnapshot(), null);

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
    expect(compareHashStub.compare).toHaveBeenCalledWith(
      ACTOR_PASSWORD,
      ACTOR_HASH,
    );
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should call assertCan with REMOVE intent', async () => {
    const { sut, lifecyclePolicyStub } = makeSut();

    await sut.execute(makeParams());

    expect(lifecyclePolicyStub.assertCan).toHaveBeenCalledTimes(1);
    expect(lifecyclePolicyStub.assertCan).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'REMOVE',
        actor: expect.objectContaining({ id: ACTOR_ID }),
        target: expect.objectContaining({ id: TARGET_ID }),
      }),
    );
  });

  it('should propagate EmployeeLifecycleForbiddenError from assertCan and not persist', async () => {
    const { sut, lifecyclePolicyStub, anonymizeEmployeeStub } = makeSut();
    lifecyclePolicyStub.assertCan.mockRejectedValueOnce(
      new EmployeeLifecycleForbiddenError(),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeLifecycleForbiddenError,
    );
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should propagate LastAdminProtectedError from assertCan and not persist', async () => {
    const { sut, lifecyclePolicyStub, anonymizeEmployeeStub } = makeSut();
    lifecyclePolicyStub.assertCan.mockRejectedValueOnce(
      new LastAdminProtectedError(),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      LastAdminProtectedError,
    );
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should propagate EmployeeNotInactiveError from assertCan and not persist', async () => {
    const { sut, lifecyclePolicyStub, anonymizeEmployeeStub } = makeSut();
    lifecyclePolicyStub.assertCan.mockRejectedValueOnce(
      new EmployeeNotInactiveError(),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeNotInactiveError,
    );
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should propagate EmployeeAlreadyRemovedError from assertCan and not persist', async () => {
    const { sut, lifecyclePolicyStub, anonymizeEmployeeStub } = makeSut();
    lifecyclePolicyStub.assertCan.mockRejectedValueOnce(
      new EmployeeAlreadyRemovedError(),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeAlreadyRemovedError,
    );
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalled();
  });

  it('should persist the anonymized $set payload and return the target id', async () => {
    const { sut, anonymizeEmployeeStub } = makeSut();

    const result = await sut.execute(makeParams());

    expect(anonymizeEmployeeStub.anonymize).toHaveBeenCalledWith({
      id: TARGET_ID,
      name: 'Removed',
      email: `removed.${TARGET_ID}@anonymized.invalid`,
      phone: null,
      nif: null,
      password: HASHED_RANDOM,
      status: EmployeeModel.Status.REMOVED,
      removedAt: expect.any(Date),
    });
    expect(result).toEqual({ id: TARGET_ID });
  });

  it('should encrypt a random secret, not the Actor password or the Target old hash', async () => {
    const { sut, encrypterStub } = makeSut();

    await sut.execute(makeParams());

    expect(encrypterStub.encrypt).toHaveBeenCalledTimes(1);
    const secret = (encrypterStub.encrypt as jest.Mock).mock.calls[0][0];
    expect(secret).not.toBe(ACTOR_PASSWORD);
    expect(secret).not.toBe(ACTOR_HASH);
    expect(secret).not.toBe(TARGET_HASH);
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('should reconstitute via Password.fromHash and persist the encrypter hash, not toJSON().password', async () => {
    const { sut, anonymizeEmployeeStub } = makeSut();
    const fromHashSpy = jest.spyOn(Password, 'fromHash');
    const createSpy = jest.spyOn(Password, 'create');

    await sut.execute(makeParams());

    expect(fromHashSpy).toHaveBeenCalledWith(ACTOR_HASH);
    expect(fromHashSpy).toHaveBeenCalledWith(TARGET_HASH);
    expect(fromHashSpy).toHaveBeenCalledWith(HASHED_RANDOM);
    expect(createSpy).not.toHaveBeenCalled();
    expect(anonymizeEmployeeStub.anonymize).toHaveBeenCalledWith(
      expect.objectContaining({ password: HASHED_RANDOM }),
    );
    expect(anonymizeEmployeeStub.anonymize).not.toHaveBeenCalledWith(
      expect.objectContaining({ password: '[REDACTED]' }),
    );
  });

  it('should compare the Actor password against the snapshot hash', async () => {
    const { sut, compareHashStub } = makeSut();

    await sut.execute(makeParams());

    expect(compareHashStub.compare).toHaveBeenCalledWith(
      ACTOR_PASSWORD,
      ACTOR_HASH,
    );
  });

  it('should propagate repository anonymize errors', async () => {
    const { sut, anonymizeEmployeeStub } = makeSut();
    jest
      .spyOn(anonymizeEmployeeStub, 'anonymize')
      .mockRejectedValueOnce(new Error('Repository error'));

    await expect(sut.execute(makeParams())).rejects.toThrow('Repository error');
  });
});
