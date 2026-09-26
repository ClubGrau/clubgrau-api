import { Employee } from '@modules/employees/domain/entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotFoundError,
  EmployeeProfessionalDataForbiddenError,
  EmptyProfessionalEmployeeDataError,
  InvalidEmployeeRoleError,
  InvalidEmployeeStatusError,
  LastAdminProtectedError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeLifecyclePolicy } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { EmployeeProfessionalDataPolicy } from '@modules/employees/domain/services/employee-professional-data.policy';
import { EmployeeProfessionalDataPatchService } from '@modules/employees/domain/services/employee-professional-data-patch.service';
import { Password } from '@shared/domain/value-object';
import { UpdateProfessionalEmployeeDataDto } from '../dtos/update-professional-employee-data.dto';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { UpdateProfessionalEmployeeDataRepositoryPort } from '../ports/outbound/update-professional-employee-data-repository.port';
import { UpdateProfessionalEmployeeDataUsecase } from './update-professional-employee-data.usecase';

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
  jobTitle: 'old',
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
    jobTitle: null,
    ...overrides,
  });

type ProfessionalDataPolicyStub = {
  assertCan: jest.MockedFunction<EmployeeProfessionalDataPolicy['assertCan']>;
};

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
  const updateProfessionalDataRepositoryStub: UpdateProfessionalEmployeeDataRepositoryPort =
    {
      updateProfessionalData: jest.fn().mockResolvedValue(undefined),
    };
  const professionalDataPolicyStub: ProfessionalDataPolicyStub = {
    assertCan: jest.fn().mockResolvedValue(undefined),
  };
  const lifecyclePolicyStub: LifecyclePolicyStub = {
    assertCan: jest.fn().mockResolvedValue(undefined),
  };

  return {
    findEmployeeByIdStub,
    updateProfessionalDataRepositoryStub,
    professionalDataPolicyStub,
    lifecyclePolicyStub,
  };
};

type SutTypes = {
  sut: UpdateProfessionalEmployeeDataUsecase;
  findEmployeeByIdStub: FindEmployeeByIdPort;
  updateProfessionalDataRepositoryStub: UpdateProfessionalEmployeeDataRepositoryPort;
  professionalDataPolicyStub: ProfessionalDataPolicyStub;
  lifecyclePolicyStub: LifecyclePolicyStub;
  professionalDataPatchService: EmployeeProfessionalDataPatchService;
};

const makeSut = (
  actor: EmployeeModel.toCreate | null = makeActorSnapshot(),
  target: EmployeeModel.toCreate | null = makeSnapshot(),
): SutTypes => {
  const {
    findEmployeeByIdStub,
    updateProfessionalDataRepositoryStub,
    professionalDataPolicyStub,
    lifecyclePolicyStub,
  } = makeStubs(actor, target);
  const professionalDataPatchService =
    new EmployeeProfessionalDataPatchService();
  const sut = new UpdateProfessionalEmployeeDataUsecase(
    findEmployeeByIdStub,
    professionalDataPolicyStub as unknown as EmployeeProfessionalDataPolicy,
    professionalDataPatchService,
    lifecyclePolicyStub as unknown as EmployeeLifecyclePolicy,
    updateProfessionalDataRepositoryStub,
  );
  return {
    sut,
    findEmployeeByIdStub,
    updateProfessionalDataRepositoryStub,
    professionalDataPolicyStub,
    lifecyclePolicyStub,
    professionalDataPatchService,
  };
};

const makeParams = (
  overrides: Partial<{
    actorId: string;
    id: string;
    jobTitle?: string | null;
    role?: string;
    status?: string;
  }> = {},
): UpdateProfessionalEmployeeDataDto =>
  new UpdateProfessionalEmployeeDataDto({
    actorId: ACTOR_ID,
    id: TARGET_ID,
    ...overrides,
  });

describe('UpdateProfessionalEmployeeDataUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateProfessionalEmployeeDataUsecase);
  });

  it('should throw ActorAuthenticationFailedError when actorId is missing or blank', async () => {
    const missing = makeSut();
    await expect(
      missing.sut.execute(makeParams({ actorId: '' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(missing.findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(
      missing.updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();

    const blank = makeSut();
    await expect(
      blank.sut.execute(makeParams({ actorId: '   ' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(blank.findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(
      blank.updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when Actor findById returns null', async () => {
    const { sut, updateProfessionalDataRepositoryStub, findEmployeeByIdStub } =
      makeSut(null, makeSnapshot());

    await expect(
      sut.execute(makeParams({ jobTitle: 'Barbeiro' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledTimes(1);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should throw EmployeeNotFoundError when Target findById returns null', async () => {
    const { sut, updateProfessionalDataRepositoryStub, findEmployeeByIdStub } =
      makeSut(makeActorSnapshot(), null);

    await expect(
      sut.execute(makeParams({ jobTitle: 'Barbeiro' })),
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should call findById with actorId then target id', async () => {
    const { sut, findEmployeeByIdStub } = makeSut();

    await sut.execute(makeParams({ jobTitle: 'Barbeiro' }));

    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
  });

  it('should throw EmptyProfessionalEmployeeDataError when every command key is undefined', async () => {
    const {
      sut,
      professionalDataPolicyStub,
      updateProfessionalDataRepositoryStub,
    } = makeSut();

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmptyProfessionalEmployeeDataError,
    );
    expect(professionalDataPolicyStub.assertCan).not.toHaveBeenCalled();
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should throw InvalidEmployeeRoleError for a non-enum role before policy and persist', async () => {
    const {
      sut,
      professionalDataPolicyStub,
      updateProfessionalDataRepositoryStub,
    } = makeSut();

    await expect(
      sut.execute(makeParams({ role: 'ROOT' })),
    ).rejects.toBeInstanceOf(InvalidEmployeeRoleError);
    expect(professionalDataPolicyStub.assertCan).not.toHaveBeenCalled();
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it.each(['REMOVED', 'nope'])(
    'should throw InvalidEmployeeStatusError for status %s and not persist',
    async (status) => {
      const {
        sut,
        professionalDataPolicyStub,
        updateProfessionalDataRepositoryStub,
      } = makeSut();

      await expect(sut.execute(makeParams({ status }))).rejects.toBeInstanceOf(
        InvalidEmployeeStatusError,
      );
      expect(professionalDataPolicyStub.assertCan).not.toHaveBeenCalled();
      expect(
        updateProfessionalDataRepositoryStub.updateProfessionalData,
      ).not.toHaveBeenCalled();
    },
  );

  it('should call professional assertCan with roleChange false before persist on job title only', async () => {
    const {
      sut,
      professionalDataPolicyStub,
      updateProfessionalDataRepositoryStub,
    } = makeSut();
    const order: string[] = [];

    professionalDataPolicyStub.assertCan.mockImplementation(async (input) => {
      expect(input.roleChange).toBe(false);
      expect(input.actor.toJSON().id).toBe(ACTOR_ID);
      expect(input.target.toJSON().id).toBe(TARGET_ID);
      order.push('policy');
      expect(
        updateProfessionalDataRepositoryStub.updateProfessionalData,
      ).not.toHaveBeenCalled();
    });
    (
      updateProfessionalDataRepositoryStub.updateProfessionalData as jest.Mock
    ).mockImplementation(async () => {
      order.push('persist');
    });

    await sut.execute(makeParams({ jobTitle: 'Barbeiro' }));

    expect(order).toEqual(['policy', 'persist']);
  });

  it.each([
    ['forbidden', new EmployeeProfessionalDataForbiddenError()],
    ['actor authentication failed', new ActorAuthenticationFailedError()],
    ['already removed', new EmployeeAlreadyRemovedError()],
    ['last admin', new LastAdminProtectedError()],
  ] as const)(
    'should propagate professional %s and not call lifecycle, apply, or persist',
    async (_label, error) => {
      const {
        sut,
        professionalDataPolicyStub,
        lifecyclePolicyStub,
        professionalDataPatchService,
        updateProfessionalDataRepositoryStub,
      } = makeSut();
      const applySpy = jest.spyOn(professionalDataPatchService, 'apply');
      professionalDataPolicyStub.assertCan.mockRejectedValueOnce(error);

      await expect(
        sut.execute(makeParams({ jobTitle: 'Barbeiro', role: 'MANAGER' })),
      ).rejects.toBe(error);
      expect(lifecyclePolicyStub.assertCan).not.toHaveBeenCalled();
      expect(applySpy).not.toHaveBeenCalled();
      expect(
        updateProfessionalDataRepositoryStub.updateProfessionalData,
      ).not.toHaveBeenCalled();
    },
  );

  it('should persist job title only and not call lifecycle', async () => {
    const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
      makeSut();

    await expect(
      sut.execute(makeParams({ jobTitle: 'Barbeiro' })),
    ).resolves.toEqual({ id: TARGET_ID });

    expect(lifecyclePolicyStub.assertCan).not.toHaveBeenCalled();
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledTimes(1);
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      jobTitle: 'Barbeiro',
    });
  });

  it('should persist a null job title clear', async () => {
    const { sut, updateProfessionalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ jobTitle: null }));

    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      jobTitle: null,
    });
  });

  it('should persist job title when the value equals the snapshot', async () => {
    const { sut, updateProfessionalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ jobTitle: 'old' }));

    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      jobTitle: 'old',
    });
  });

  it('should return id without persist when role echoes the target', async () => {
    const {
      sut,
      professionalDataPolicyStub,
      lifecyclePolicyStub,
      updateProfessionalDataRepositoryStub,
    } = makeSut();

    await expect(
      sut.execute(makeParams({ role: EmployeeModel.Role.EMPLOYEE })),
    ).resolves.toEqual({ id: TARGET_ID });

    expect(professionalDataPolicyStub.assertCan).toHaveBeenCalledWith(
      expect.objectContaining({ roleChange: false }),
    );
    expect(lifecyclePolicyStub.assertCan).not.toHaveBeenCalled();
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should persist a role delta and report roleChange true', async () => {
    const {
      sut,
      professionalDataPolicyStub,
      updateProfessionalDataRepositoryStub,
    } = makeSut();

    await sut.execute(makeParams({ role: EmployeeModel.Role.MANAGER }));

    expect(professionalDataPolicyStub.assertCan).toHaveBeenCalledWith(
      expect.objectContaining({ roleChange: true }),
    );
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      role: EmployeeModel.Role.MANAGER,
    });
  });

  it('should return id without persist or lifecycle when status echoes the target', async () => {
    const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
      makeSut();

    await expect(
      sut.execute(makeParams({ status: EmployeeModel.Status.ACTIVE })),
    ).resolves.toEqual({ id: TARGET_ID });

    expect(lifecyclePolicyStub.assertCan).not.toHaveBeenCalled();
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should deactivate on an INACTIVE delta and persist status with deactivateAt', async () => {
    const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
      makeSut();

    await sut.execute(makeParams({ status: EmployeeModel.Status.INACTIVE }));

    expect(lifecyclePolicyStub.assertCan).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'DEACTIVATE' }),
    );
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.INACTIVE,
      deactivateAt: expect.any(Date),
    });
  });

  it('should reactivate an inactive target and persist a null deactivateAt', async () => {
    const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
      makeSut(
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
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.ACTIVE,
      deactivateAt: null,
    });
  });

  it('should put an active target on vacation and persist a null deactivateAt', async () => {
    const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
      makeSut();

    await sut.execute(makeParams({ status: EmployeeModel.Status.VACATION }));

    expect(lifecyclePolicyStub.assertCan).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'VACATION' }),
    );
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      status: EmployeeModel.Status.VACATION,
      deactivateAt: null,
    });
  });

  it.each([
    ['forbidden', new EmployeeLifecycleForbiddenError()],
    ['actor authentication failed', new ActorAuthenticationFailedError()],
    ['last admin', new LastAdminProtectedError()],
  ] as const)(
    'should propagate lifecycle %s and not persist',
    async (_label, error) => {
      const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
        makeSut();
      lifecyclePolicyStub.assertCan.mockRejectedValueOnce(error);

      await expect(
        sut.execute(makeParams({ status: EmployeeModel.Status.INACTIVE })),
      ).rejects.toBe(error);
      expect(
        updateProfessionalDataRepositoryStub.updateProfessionalData,
      ).not.toHaveBeenCalled();
    },
  );

  it('should persist job title only when role echoes', async () => {
    const { sut, updateProfessionalDataRepositoryStub } = makeSut();

    await sut.execute(
      makeParams({
        jobTitle: 'Barbeiro',
        role: EmployeeModel.Role.EMPLOYEE,
      }),
    );

    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      jobTitle: 'Barbeiro',
    });
  });

  it('should persist job title only when status echoes and not call lifecycle', async () => {
    const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
      makeSut();

    await sut.execute(
      makeParams({
        jobTitle: 'Barbeiro',
        status: EmployeeModel.Status.ACTIVE,
      }),
    );

    expect(lifecyclePolicyStub.assertCan).not.toHaveBeenCalled();
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      jobTitle: 'Barbeiro',
    });
  });

  it('should not persist when role and status both echo and job title is absent', async () => {
    const { sut, updateProfessionalDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(
        makeParams({
          role: EmployeeModel.Role.EMPLOYEE,
          status: EmployeeModel.Status.ACTIVE,
        }),
      ),
    ).resolves.toEqual({ id: TARGET_ID });

    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should persist job title, role, status, and deactivateAt in one call', async () => {
    const { sut, updateProfessionalDataRepositoryStub } = makeSut();

    await sut.execute(
      makeParams({
        jobTitle: 'Barbeiro',
        role: EmployeeModel.Role.MANAGER,
        status: EmployeeModel.Status.INACTIVE,
      }),
    );

    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledTimes(1);
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      jobTitle: 'Barbeiro',
      role: EmployeeModel.Role.MANAGER,
      status: EmployeeModel.Status.INACTIVE,
      deactivateAt: expect.any(Date),
    });
  });

  it('should not persist when a role delta is refused and status is also present', async () => {
    const {
      sut,
      professionalDataPolicyStub,
      updateProfessionalDataRepositoryStub,
    } = makeSut();
    professionalDataPolicyStub.assertCan.mockRejectedValueOnce(
      new LastAdminProtectedError(),
    );

    await expect(
      sut.execute(
        makeParams({
          role: EmployeeModel.Role.MANAGER,
          status: EmployeeModel.Status.INACTIVE,
        }),
      ),
    ).rejects.toBeInstanceOf(LastAdminProtectedError);
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should not persist when a status delta is refused and job title is present', async () => {
    const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
      makeSut();
    lifecyclePolicyStub.assertCan.mockRejectedValueOnce(
      new EmployeeLifecycleForbiddenError(),
    );

    await expect(
      sut.execute(
        makeParams({
          jobTitle: 'Barbeiro',
          status: EmployeeModel.Status.INACTIVE,
        }),
      ),
    ).rejects.toBeInstanceOf(EmployeeLifecycleForbiddenError);
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should reconstitute via Password.fromHash, not Password.create or Employee.create', async () => {
    const { sut } = makeSut();
    const fromHashSpy = jest.spyOn(Password, 'fromHash');
    const createPasswordSpy = jest.spyOn(Password, 'create');
    const createEmployeeSpy = jest.spyOn(Employee, 'create');

    await sut.execute(makeParams({ jobTitle: 'Barbeiro' }));

    expect(fromHashSpy).toHaveBeenCalledWith(HASHED_PASSWORD);
    expect(createPasswordSpy).not.toHaveBeenCalled();
    expect(createEmployeeSpy).not.toHaveBeenCalled();
  });

  it('should reconstitute Target keeping snapshot jobTitle', async () => {
    const { sut, updateProfessionalDataRepositoryStub } = makeSut();
    const reconstituteSpy = jest.spyOn(Employee, 'reconstitute');

    await sut.execute(makeParams({ role: EmployeeModel.Role.EMPLOYEE }));

    const targetCall = reconstituteSpy.mock.calls.find(
      ([input]) => input.id === TARGET_ID,
    );
    expect(targetCall?.[0].jobTitle).toBe('old');
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).not.toHaveBeenCalled();
  });

  it('should not depend on encrypter, occupancy, or main/personal policies', () => {
    expect(UpdateProfessionalEmployeeDataUsecase.length).toBe(5);
  });

  it('should not take an updateStatus collaborator', () => {
    const { sut } = makeSut();
    expect(UpdateProfessionalEmployeeDataUsecase.length).toBe(5);
    expect(sut).not.toHaveProperty('updateEmployeeStatusRepository');
    expect(sut).not.toHaveProperty('updateStatus');
  });

  it('should persist job title on an inactive target without calling lifecycle', async () => {
    const { sut, lifecyclePolicyStub, updateProfessionalDataRepositoryStub } =
      makeSut(
        makeActorSnapshot(),
        makeSnapshot({ status: EmployeeModel.Status.INACTIVE }),
      );

    await sut.execute(makeParams({ jobTitle: 'Barbeiro' }));

    expect(lifecyclePolicyStub.assertCan).not.toHaveBeenCalled();
    expect(
      updateProfessionalDataRepositoryStub.updateProfessionalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      jobTitle: 'Barbeiro',
    });
  });
});
