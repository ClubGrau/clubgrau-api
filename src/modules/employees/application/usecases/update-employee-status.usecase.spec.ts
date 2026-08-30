import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyActiveError,
  EmployeeAlreadyInactiveError,
  EmployeeAlreadyOnVacationError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  InvalidEmployeeStatusError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeLifecyclePolicy } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { Password } from '@shared/domain/value-object';
import { UpdateEmployeeStatusDto } from '../dtos/update-employee-status.dto';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { UpdateEmployeeStatusRepositoryPort } from '../ports/outbound/update-employee-status-repository.port';
import { UpdateEmployeeStatusUsecase } from './update-employee-status.usecase';

const ACTOR_ID = '507f1f77bcf86cd799439022';
const TARGET_ID = '507f1f77bcf86cd799439011';
const HASHED_PASSWORD = '$2b$10$abcdefghijklmnopqrstuv';

const makeSnapshot = (
  overrides: Partial<EmployeeModel.toCreate> = {},
): EmployeeModel.toCreate => ({
  id: TARGET_ID,
  name: 'John Doe',
  email: 'john.doe@example.com',
  password: HASHED_PASSWORD,
  role: EmployeeModel.Role.EMPLOYEE,
  phone: null,
  nif: null,
  status: EmployeeModel.Status.ACTIVE,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  deactivateAt: null,
  removedAt: null,
  username: null,
  gender: null,
  address: null,
  languages: null,
  emergencyContact: null,
  employmentId: null,
  jobTitle: null,
  ...overrides,
});

const makeActorSnapshot = (
  overrides: Partial<EmployeeModel.toCreate> = {},
): EmployeeModel.toCreate =>
  makeSnapshot({
    id: ACTOR_ID,
    name: 'Admin Actor',
    email: 'admin.actor@example.com',
    role: EmployeeModel.Role.ADMIN,
    status: EmployeeModel.Status.ACTIVE,
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
  const updateEmployeeStatusRepositoryStub: UpdateEmployeeStatusRepositoryPort =
    {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
  const lifecyclePolicyStub: LifecyclePolicyStub = {
    assertCan: jest.fn().mockResolvedValue(undefined),
  };

  return {
    findEmployeeByIdStub,
    updateEmployeeStatusRepositoryStub,
    lifecyclePolicyStub,
  };
};

const makeSut = (
  actor: EmployeeModel.toCreate | null = makeActorSnapshot(),
  target: EmployeeModel.toCreate | null = makeSnapshot(),
): SutTypes => {
  const {
    findEmployeeByIdStub,
    updateEmployeeStatusRepositoryStub,
    lifecyclePolicyStub,
  } = makeStubs(actor, target);
  const sut = new UpdateEmployeeStatusUsecase(
    findEmployeeByIdStub,
    updateEmployeeStatusRepositoryStub,
    lifecyclePolicyStub as unknown as EmployeeLifecyclePolicy,
  );
  return {
    sut,
    findEmployeeByIdStub,
    updateEmployeeStatusRepositoryStub,
    lifecyclePolicyStub,
  };
};

const makeParams = (
  overrides: Partial<UpdateEmployeeStatusDto> = {},
): UpdateEmployeeStatusDto => ({
  actorId: ACTOR_ID,
  id: TARGET_ID,
  status: EmployeeModel.Status.INACTIVE,
  ...overrides,
});

type SutTypes = {
  sut: UpdateEmployeeStatusUsecase;
  findEmployeeByIdStub: FindEmployeeByIdPort;
  updateEmployeeStatusRepositoryStub: UpdateEmployeeStatusRepositoryPort;
  lifecyclePolicyStub: LifecyclePolicyStub;
};

describe('UpdateEmployeeStatusUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateEmployeeStatusUsecase);
  });

  it('should throw ActorAuthenticationFailedError when actorId is missing', async () => {
    const { sut, updateEmployeeStatusRepositoryStub, findEmployeeByIdStub } =
      makeSut();
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await expect(
      sut.execute(makeParams({ actorId: '' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when actorId is blank', async () => {
    const { sut, updateEmployeeStatusRepositoryStub, findEmployeeByIdStub } =
      makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '   ' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when Actor findById returns null', async () => {
    const { sut, updateEmployeeStatusRepositoryStub, findEmployeeByIdStub } =
      makeSut(null, makeSnapshot());

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledTimes(1);
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should throw EmployeeNotFoundError when Target findById returns null', async () => {
    const { sut, updateEmployeeStatusRepositoryStub, findEmployeeByIdStub } =
      makeSut(makeActorSnapshot(), null);

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should call findById with actorId then target id', async () => {
    const { sut, findEmployeeByIdStub } = makeSut();

    await sut.execute(makeParams());

    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
  });

  it('should map INACTIVE to DEACTIVATE and call assertCan', async () => {
    const { sut, lifecyclePolicyStub } = makeSut();

    await sut.execute(makeParams());

    expect(lifecyclePolicyStub.assertCan).toHaveBeenCalledTimes(1);
    expect(lifecyclePolicyStub.assertCan).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'DEACTIVATE',
        actor: expect.objectContaining({ id: ACTOR_ID }),
        target: expect.objectContaining({ id: TARGET_ID }),
      }),
    );
  });

  it('should map ACTIVE to REACTIVATE', async () => {
    const { sut, lifecyclePolicyStub } = makeSut(
      makeActorSnapshot(),
      makeSnapshot({
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt: new Date('2024-06-01T00:00:00.000Z'),
      }),
    );

    await sut.execute(makeParams({ status: EmployeeModel.Status.ACTIVE }));

    expect(lifecyclePolicyStub.assertCan).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'REACTIVATE' }),
    );
  });

  it('should map VACATION to VACATION', async () => {
    const { sut, lifecyclePolicyStub } = makeSut();

    await sut.execute(makeParams({ status: EmployeeModel.Status.VACATION }));

    expect(lifecyclePolicyStub.assertCan).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'VACATION' }),
    );
  });

  it('should propagate EmployeeLifecycleForbiddenError from assertCan and not persist', async () => {
    const { sut, lifecyclePolicyStub, updateEmployeeStatusRepositoryStub } =
      makeSut();
    lifecyclePolicyStub.assertCan.mockRejectedValueOnce(
      new EmployeeLifecycleForbiddenError(),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeLifecycleForbiddenError,
    );
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should propagate LastAdminProtectedError from assertCan and not persist', async () => {
    const { sut, lifecyclePolicyStub, updateEmployeeStatusRepositoryStub } =
      makeSut();
    lifecyclePolicyStub.assertCan.mockRejectedValueOnce(
      new LastAdminProtectedError(),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      LastAdminProtectedError,
    );
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should propagate ActorAuthenticationFailedError from assertCan and not persist', async () => {
    const { sut, lifecyclePolicyStub, updateEmployeeStatusRepositoryStub } =
      makeSut();
    lifecyclePolicyStub.assertCan.mockRejectedValueOnce(
      new ActorAuthenticationFailedError(),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should deactivate an ACTIVE employee and persist INACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut();

    const result = await sut.execute(makeParams());

    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.INACTIVE,
      deactivateAt: expect.any(Date),
    });
    expect(result).toEqual({
      id: TARGET_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
  });

  it('should activate an INACTIVE employee and persist ACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeActorSnapshot(),
      makeSnapshot({
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt: new Date('2024-06-01T00:00:00.000Z'),
      }),
    );

    const result = await sut.execute(
      makeParams({ status: EmployeeModel.Status.ACTIVE }),
    );

    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.ACTIVE,
      deactivateAt: null,
    });
    expect(result).toEqual({
      id: TARGET_ID,
      status: EmployeeModel.Status.ACTIVE,
    });
  });

  it('should put an ACTIVE employee on vacation and persist VACATION', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut();

    const result = await sut.execute(
      makeParams({ status: EmployeeModel.Status.VACATION }),
    );

    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.VACATION,
      deactivateAt: null,
    });
    expect(result).toEqual({
      id: TARGET_ID,
      status: EmployeeModel.Status.VACATION,
    });
  });

  it('should persist INACTIVE → VACATION', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeActorSnapshot(),
      makeSnapshot({
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt: new Date('2024-06-01T00:00:00.000Z'),
      }),
    );

    await sut.execute(makeParams({ status: EmployeeModel.Status.VACATION }));

    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.VACATION,
      deactivateAt: null,
    });
  });

  it('should persist VACATION → INACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeActorSnapshot(),
      makeSnapshot({ status: EmployeeModel.Status.VACATION }),
    );

    await sut.execute(makeParams({ status: EmployeeModel.Status.INACTIVE }));

    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.INACTIVE,
      deactivateAt: expect.any(Date),
    });
  });

  it('should persist VACATION → ACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeActorSnapshot(),
      makeSnapshot({ status: EmployeeModel.Status.VACATION }),
    );

    await sut.execute(makeParams({ status: EmployeeModel.Status.ACTIVE }));

    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.ACTIVE,
      deactivateAt: null,
    });
  });

  it('should throw EmployeeAlreadyActiveError when already ACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut();

    await expect(
      sut.execute(makeParams({ status: EmployeeModel.Status.ACTIVE })),
    ).rejects.toBeInstanceOf(EmployeeAlreadyActiveError);
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should throw EmployeeAlreadyInactiveError when already INACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeActorSnapshot(),
      makeSnapshot({
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt: new Date('2024-06-01T00:00:00.000Z'),
      }),
    );

    await expect(
      sut.execute(makeParams({ status: EmployeeModel.Status.INACTIVE })),
    ).rejects.toBeInstanceOf(EmployeeAlreadyInactiveError);
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should throw EmployeeAlreadyOnVacationError when already VACATION', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeActorSnapshot(),
      makeSnapshot({ status: EmployeeModel.Status.VACATION }),
    );

    await expect(
      sut.execute(makeParams({ status: EmployeeModel.Status.VACATION })),
    ).rejects.toBeInstanceOf(EmployeeAlreadyOnVacationError);
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should reconstitute via Password.fromHash, not Password.create', async () => {
    const { sut } = makeSut();
    const fromHashSpy = jest.spyOn(Password, 'fromHash');
    const createSpy = jest.spyOn(Password, 'create');

    await sut.execute(makeParams());

    expect(fromHashSpy).toHaveBeenCalledWith(HASHED_PASSWORD);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should not call Encrypter or EmployeePoliciesService', async () => {
    const { sut } = makeSut();

    await expect(sut.execute(makeParams())).resolves.toEqual({
      id: TARGET_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
    expect(UpdateEmployeeStatusUsecase.length).toBe(3);
  });

  it('should propagate repository updateStatus errors', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut();
    jest
      .spyOn(updateEmployeeStatusRepositoryStub, 'updateStatus')
      .mockRejectedValueOnce(new Error('Repository error'));

    await expect(sut.execute(makeParams())).rejects.toThrow('Repository error');
  });

  it('should return { id, status } after a successful transition', async () => {
    const { sut } = makeSut();

    const result = await sut.execute(makeParams());

    expect(result).toEqual({
      id: TARGET_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
  });

  it('should throw InvalidEmployeeStatusError and not persist when status is REMOVED', async () => {
    const { sut, updateEmployeeStatusRepositoryStub, lifecyclePolicyStub } =
      makeSut();

    await expect(
      sut.execute(
        makeParams({
          status: EmployeeModel.Status
            .REMOVED as unknown as EmployeeModel.OperationalStatus,
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidEmployeeStatusError);
    expect(lifecyclePolicyStub.assertCan).not.toHaveBeenCalled();
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it('should throw InvalidEmployeeStatusError for an unknown status value (exhaustiveness guard)', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut();

    await expect(
      sut.execute(
        makeParams({
          status: 'UNKNOWN' as unknown as EmployeeModel.OperationalStatus,
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidEmployeeStatusError);
    expect(
      updateEmployeeStatusRepositoryStub.updateStatus,
    ).not.toHaveBeenCalled();
  });
});
