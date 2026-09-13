import { Employee } from '@modules/employees/domain/entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyExistsError,
  EmployeeAlreadyRemovedError,
  EmployeeInactiveError,
  EmployeeMainDataForbiddenError,
  EmployeeNotFoundError,
  EmptyMainEmployeeDataError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeMainDataPolicy } from '@modules/employees/domain/services/employee-main-data.policy';
import { EmployeeMainDataPatchService } from '@modules/employees/domain/services/employee-main-data-patch.service';
import { EmployeePoliciesService } from '@modules/employees/domain/services/employee-policies.service';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPhoneFormatError,
  Password,
} from '@shared/domain/value-object';
import { UpdateMainEmployeeDataDto } from '../dtos/update-main-employee-data.dto';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { UpdateMainEmployeeDataRepositoryPort } from '../ports/outbound/update-main-employee-data-repository.port';
import { UpdateMainEmployeeDataUsecase } from './update-main-employee-data.usecase';

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
  username: 'old.user',
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
    username: null,
    ...overrides,
  });

type MainDataPolicyStub = {
  assertCan: jest.MockedFunction<EmployeeMainDataPolicy['assertCan']>;
};

type EmployeePoliciesServiceStub = {
  ensureEmailIsAvailable: jest.MockedFunction<
    EmployeePoliciesService['ensureEmailIsAvailable']
  >;
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
  const updateMainDataRepositoryStub: UpdateMainEmployeeDataRepositoryPort = {
    updateMainData: jest.fn().mockResolvedValue(undefined),
  };
  const mainDataPolicyStub: MainDataPolicyStub = {
    assertCan: jest.fn(),
  };
  const employeePoliciesServiceStub: EmployeePoliciesServiceStub = {
    ensureEmailIsAvailable: jest.fn().mockResolvedValue(undefined),
  };

  return {
    findEmployeeByIdStub,
    updateMainDataRepositoryStub,
    mainDataPolicyStub,
    employeePoliciesServiceStub,
  };
};

type SutTypes = {
  sut: UpdateMainEmployeeDataUsecase;
  findEmployeeByIdStub: FindEmployeeByIdPort;
  updateMainDataRepositoryStub: UpdateMainEmployeeDataRepositoryPort;
  mainDataPolicyStub: MainDataPolicyStub;
  employeePoliciesServiceStub: EmployeePoliciesServiceStub;
};

const makeSut = (
  actor: EmployeeModel.toCreate | null = makeActorSnapshot(),
  target: EmployeeModel.toCreate | null = makeSnapshot(),
): SutTypes => {
  const {
    findEmployeeByIdStub,
    updateMainDataRepositoryStub,
    mainDataPolicyStub,
    employeePoliciesServiceStub,
  } = makeStubs(actor, target);
  const mainDataPatchService = new EmployeeMainDataPatchService(
    employeePoliciesServiceStub as unknown as EmployeePoliciesService,
  );
  const sut = new UpdateMainEmployeeDataUsecase(
    findEmployeeByIdStub,
    mainDataPatchService,
    mainDataPolicyStub as unknown as EmployeeMainDataPolicy,
    updateMainDataRepositoryStub,
  );
  return {
    sut,
    findEmployeeByIdStub,
    updateMainDataRepositoryStub,
    mainDataPolicyStub,
    employeePoliciesServiceStub,
  };
};

const makeParams = (
  overrides: Partial<{
    actorId: string;
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    username?: string | null;
  }> = {},
): UpdateMainEmployeeDataDto =>
  new UpdateMainEmployeeDataDto({
    actorId: ACTOR_ID,
    id: TARGET_ID,
    name: 'Jane Smith',
    ...overrides,
  });

describe('UpdateMainEmployeeDataUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateMainEmployeeDataUsecase);
  });

  it('should throw ActorAuthenticationFailedError when actorId is missing', async () => {
    const { sut, updateMainDataRepositoryStub, findEmployeeByIdStub } =
      makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when actorId is blank', async () => {
    const { sut, updateMainDataRepositoryStub, findEmployeeByIdStub } =
      makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '   ' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when Actor findById returns null', async () => {
    const { sut, updateMainDataRepositoryStub, findEmployeeByIdStub } = makeSut(
      null,
      makeSnapshot(),
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledTimes(1);
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should throw EmployeeNotFoundError when Target findById returns null', async () => {
    const { sut, updateMainDataRepositoryStub, findEmployeeByIdStub } = makeSut(
      makeActorSnapshot(),
      null,
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should call findById with actorId then target id', async () => {
    const { sut, findEmployeeByIdStub } = makeSut();

    await sut.execute(makeParams());

    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
  });

  it('should propagate EmployeeMainDataForbiddenError from assertCan and not persist', async () => {
    const { sut, mainDataPolicyStub, updateMainDataRepositoryStub } = makeSut();
    mainDataPolicyStub.assertCan.mockImplementation(() => {
      throw new EmployeeMainDataForbiddenError();
    });

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeMainDataForbiddenError,
    );
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should propagate ActorAuthenticationFailedError from assertCan and not persist', async () => {
    const { sut, mainDataPolicyStub, updateMainDataRepositoryStub } = makeSut();
    mainDataPolicyStub.assertCan.mockImplementation(() => {
      throw new ActorAuthenticationFailedError();
    });

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      ActorAuthenticationFailedError,
    );
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should propagate EmployeeAlreadyRemovedError from assertCan and not persist', async () => {
    const { sut, mainDataPolicyStub, updateMainDataRepositoryStub } = makeSut();
    mainDataPolicyStub.assertCan.mockImplementation(() => {
      throw new EmployeeAlreadyRemovedError();
    });

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeAlreadyRemovedError,
    );
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should persist name only and not call ensureEmailIsAvailable', async () => {
    const { sut, updateMainDataRepositoryStub, employeePoliciesServiceStub } =
      makeSut();

    const result = await sut.execute(makeParams({ name: 'Jane Smith' }));

    expect(
      employeePoliciesServiceStub.ensureEmailIsAvailable,
    ).not.toHaveBeenCalled();
    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      name: 'Jane Smith',
    });
    expect(result).toEqual({ id: TARGET_ID });
  });

  it('should not call ensureEmailIsAvailable when email is omitted', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();

    await sut.execute(makeParams({ email: undefined, name: 'Jane Smith' }));

    expect(
      employeePoliciesServiceStub.ensureEmailIsAvailable,
    ).not.toHaveBeenCalled();
  });

  it('should not call ensureEmailIsAvailable when email matches Target with different case', async () => {
    const { sut, employeePoliciesServiceStub, updateMainDataRepositoryStub } =
      makeSut();

    await sut.execute(
      makeParams({ email: 'John.Doe@Example.com', name: undefined }),
    );

    expect(
      employeePoliciesServiceStub.ensureEmailIsAvailable,
    ).not.toHaveBeenCalled();
    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      email: 'john.doe@example.com',
    });
  });

  it('should call ensureEmailIsAvailable and persist when email is new and free', async () => {
    const { sut, employeePoliciesServiceStub, updateMainDataRepositoryStub } =
      makeSut();

    await sut.execute(
      makeParams({ email: 'new.email@example.com', name: undefined }),
    );

    expect(
      employeePoliciesServiceStub.ensureEmailIsAvailable,
    ).toHaveBeenCalledWith('new.email@example.com');
    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      email: 'new.email@example.com',
    });
  });

  it('should throw EmployeeAlreadyExistsError when new email is held by ACTIVE and not persist', async () => {
    const { sut, employeePoliciesServiceStub, updateMainDataRepositoryStub } =
      makeSut();
    employeePoliciesServiceStub.ensureEmailIsAvailable.mockRejectedValueOnce(
      new EmployeeAlreadyExistsError(),
    );

    await expect(
      sut.execute(makeParams({ email: 'taken@example.com', name: undefined })),
    ).rejects.toBeInstanceOf(EmployeeAlreadyExistsError);
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should throw EmployeeInactiveError when new email is held by INACTIVE and not persist', async () => {
    const { sut, employeePoliciesServiceStub, updateMainDataRepositoryStub } =
      makeSut();
    employeePoliciesServiceStub.ensureEmailIsAvailable.mockRejectedValueOnce(
      new EmployeeInactiveError(),
    );

    await expect(
      sut.execute(
        makeParams({ email: 'inactive@example.com', name: undefined }),
      ),
    ).rejects.toBeInstanceOf(EmployeeInactiveError);
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should clear username when username is empty string', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ username: '', name: undefined }));

    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      username: null,
    });
  });

  it('should clear username when username is whitespace', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ username: '   ', name: undefined }));

    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      username: null,
    });
  });

  it('should clear username when username is null', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ username: null, name: undefined }));

    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      username: null,
    });
  });

  it('should trim username before persist', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ username: '  jdoe  ', name: undefined }));

    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      username: 'jdoe',
    });
  });

  it('should persist phone and never call changePhone with null', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();
    const changePhoneSpy = jest.spyOn(Employee.prototype, 'changePhone');

    await sut.execute(
      makeParams({ phone: '+351 912 345 678', name: undefined }),
    );

    expect(changePhoneSpy).toHaveBeenCalled();
    expect(changePhoneSpy).not.toHaveBeenCalledWith(null);
    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      phone: '351912345678',
    });
  });

  it('should throw InvalidNameError for invalid name and not persist', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await expect(sut.execute(makeParams({ name: 'A' }))).rejects.toBeInstanceOf(
      InvalidNameError,
    );
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should throw InvalidEmailError for invalid email and not persist', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(makeParams({ email: 'not-an-email', name: undefined })),
    ).rejects.toBeInstanceOf(InvalidEmailError);
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should throw InvalidPhoneFormatError for invalid phone and not persist', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(makeParams({ phone: '123', name: undefined })),
    ).rejects.toBeInstanceOf(InvalidPhoneFormatError);
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should throw when no Main Data keys are present and not persist', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(
        new UpdateMainEmployeeDataDto({
          actorId: ACTOR_ID,
          id: TARGET_ID,
        }),
      ),
    ).rejects.toBeInstanceOf(EmptyMainEmployeeDataError);
    expect(updateMainDataRepositoryStub.updateMainData).not.toHaveBeenCalled();
  });

  it('should reconstitute via Password.fromHash, not Password.create', async () => {
    const { sut } = makeSut();
    const fromHashSpy = jest.spyOn(Password, 'fromHash');
    const createSpy = jest.spyOn(Password, 'create');

    await sut.execute(makeParams());

    expect(fromHashSpy).toHaveBeenCalledWith(HASHED_PASSWORD);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should reconstitute Target with username from snapshot and not persist username on name-only update', async () => {
    const { sut, updateMainDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ name: 'Jane Smith' }));

    expect(updateMainDataRepositoryStub.updateMainData).toHaveBeenCalledWith({
      id: TARGET_ID,
      name: 'Jane Smith',
    });
    const persistPayload = (
      updateMainDataRepositoryStub.updateMainData as jest.Mock
    ).mock.calls[0][0];
    expect(persistPayload).not.toHaveProperty('username');
  });

  it('should not depend on Encrypter, CompareHashPort, or EmployeeLifecyclePolicy', () => {
    expect(UpdateMainEmployeeDataUsecase.length).toBe(4);
  });
});
