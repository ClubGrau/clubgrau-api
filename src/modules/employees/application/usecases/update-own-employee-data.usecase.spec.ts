import { Employee } from '@modules/employees/domain/entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmptyOwnEmployeeDataError,
  InvalidEmployeeGenderError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeOwnDataPatchService } from '@modules/employees/domain/services/employee-own-data-patch.service';
import { EmployeeOwnDataPolicy } from '@modules/employees/domain/services/employee-own-data.policy';
import { EmployeePersonalDataPatchService } from '@modules/employees/domain/services/employee-personal-data-patch.service';
import { DomainError } from '@shared/domain/errors/domain.error';
import { InvalidNifError, Password } from '@shared/domain/value-object';
import { GetEmployeesItemDto } from '../dtos/get-employees.dto';
import { UpdateOwnEmployeeDataDto } from '../dtos/update-own-employee-data.dto';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { FindOwnEmployeePort } from '../ports/outbound/find-own-employee.port';
import { UpdateOwnEmployeeDataRepositoryPort } from '../ports/outbound/update-own-employee-data-repository.port';
import { UpdateOwnEmployeeDataUsecase } from './update-own-employee-data.usecase';

const ACTOR_ID = '507f1f77bcf86cd799439022';
const HASHED_PASSWORD = '$2b$10$abcdefghijklmnopqrstuv';
const STORED_PHONE = '351900000000';
const STORED_EMERGENCY_CONTACT = '351912000001';

const makeActorSnapshot = (
  overrides: Partial<EmployeeModel.toCreate> = {},
): EmployeeModel.toCreate => ({
  id: ACTOR_ID,
  name: 'John Doe',
  email: 'john.doe@example.com',
  password: HASHED_PASSWORD,
  role: EmployeeModel.Role.EMPLOYEE,
  phone: STORED_PHONE,
  nif: '123456789',
  status: EmployeeModel.Status.ACTIVE,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  deactivateAt: null,
  removedAt: null,
  username: 'old.user',
  gender: 'female',
  address: 'old',
  languages: 'en',
  emergencyContact: STORED_EMERGENCY_CONTACT,
  employmentId: null,
  jobTitle: null,
  ...overrides,
});

const makeReadModel = (
  snapshot: EmployeeModel.toCreate = makeActorSnapshot(),
): GetEmployeesItemDto => ({
  id: snapshot.id,
  name: snapshot.name,
  email: snapshot.email,
  role: snapshot.role,
  phone: snapshot.phone,
  nif: snapshot.nif,
  status: snapshot.status,
  createdAt: snapshot.createdAt,
  deactivateAt: snapshot.deactivateAt,
  username: snapshot.username,
  gender: snapshot.gender,
  address: snapshot.address,
  languages: snapshot.languages,
  emergencyContact: snapshot.emergencyContact,
  employmentId: snapshot.employmentId,
  jobTitle: snapshot.jobTitle,
});

type OwnDataPolicyStub = {
  assertCan: jest.MockedFunction<EmployeeOwnDataPolicy['assertCan']>;
};

const makeStubs = (
  actor: EmployeeModel.toCreate | null = makeActorSnapshot(),
) => {
  const readModel = makeReadModel(actor ?? makeActorSnapshot());
  const findEmployeeByIdStub: FindEmployeeByIdPort = {
    findById: jest.fn(async (id: string) => {
      if (actor && id === actor.id) {
        return actor;
      }
      return null;
    }),
  };
  const updateOwnDataRepositoryStub: UpdateOwnEmployeeDataRepositoryPort = {
    updateOwnData: jest.fn().mockResolvedValue(undefined),
  };
  const ownDataPolicyStub: OwnDataPolicyStub = {
    assertCan: jest.fn(),
  };
  const findOwnEmployeeStub: FindOwnEmployeePort = {
    findOwnEmployee: jest.fn().mockResolvedValue(readModel),
  };

  return {
    findEmployeeByIdStub,
    updateOwnDataRepositoryStub,
    ownDataPolicyStub,
    findOwnEmployeeStub,
    readModel,
  };
};

type SutTypes = {
  sut: UpdateOwnEmployeeDataUsecase;
  findEmployeeByIdStub: FindEmployeeByIdPort;
  updateOwnDataRepositoryStub: UpdateOwnEmployeeDataRepositoryPort;
  ownDataPolicyStub: OwnDataPolicyStub;
  findOwnEmployeeStub: FindOwnEmployeePort;
  ownDataPatchService: EmployeeOwnDataPatchService;
  readModel: GetEmployeesItemDto;
};

const makeSut = (
  actor: EmployeeModel.toCreate | null = makeActorSnapshot(),
): SutTypes => {
  const {
    findEmployeeByIdStub,
    updateOwnDataRepositoryStub,
    ownDataPolicyStub,
    findOwnEmployeeStub,
    readModel,
  } = makeStubs(actor);
  const ownDataPatchService = new EmployeeOwnDataPatchService(
    new EmployeePersonalDataPatchService(),
  );
  const sut = new UpdateOwnEmployeeDataUsecase(
    findEmployeeByIdStub,
    ownDataPolicyStub as unknown as EmployeeOwnDataPolicy,
    ownDataPatchService,
    updateOwnDataRepositoryStub,
    findOwnEmployeeStub,
  );

  return {
    sut,
    findEmployeeByIdStub,
    updateOwnDataRepositoryStub,
    ownDataPolicyStub,
    findOwnEmployeeStub,
    ownDataPatchService,
    readModel,
  };
};

const makeParams = (
  overrides: Partial<{
    actorId: string;
    name?: string;
    phone?: string;
    username?: string | null;
    gender?: string | null;
    languages?: string | null;
    emergencyContact?: string | null;
    nif?: string | null;
    address?: string | null;
  }> = {},
): UpdateOwnEmployeeDataDto =>
  new UpdateOwnEmployeeDataDto({
    actorId: ACTOR_ID,
    ...overrides,
  });

const persistPayload = (
  repository: UpdateOwnEmployeeDataRepositoryPort,
): Record<string, unknown> =>
  (repository.updateOwnData as jest.Mock).mock.calls[0][0];

describe('UpdateOwnEmployeeDataUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateOwnEmployeeDataUsecase);
  });

  it('should throw ActorAuthenticationFailedError when actorId is missing or blank', async () => {
    const {
      sut,
      findEmployeeByIdStub,
      updateOwnDataRepositoryStub,
      findOwnEmployeeStub,
    } = makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    await expect(
      sut.execute(makeParams({ actorId: '   ' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);

    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(updateOwnDataRepositoryStub.updateOwnData).not.toHaveBeenCalled();
    expect(findOwnEmployeeStub.findOwnEmployee).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when Actor findById returns null', async () => {
    const {
      sut,
      findEmployeeByIdStub,
      updateOwnDataRepositoryStub,
      findOwnEmployeeStub,
    } = makeSut(null);

    await expect(
      sut.execute(makeParams({ phone: '+351 912 345 678' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledTimes(1);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
    expect(updateOwnDataRepositoryStub.updateOwnData).not.toHaveBeenCalled();
    expect(findOwnEmployeeStub.findOwnEmployee).not.toHaveBeenCalled();
  });

  it('should call findById once with actorId only', async () => {
    const { sut, findEmployeeByIdStub } = makeSut();

    await sut.execute(makeParams({ gender: 'male' }));

    expect(findEmployeeByIdStub.findById).toHaveBeenCalledTimes(1);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
  });

  it('should call assertCan with actor.status before persisting', async () => {
    const { sut, ownDataPolicyStub, updateOwnDataRepositoryStub } = makeSut();
    const order: string[] = [];
    ownDataPolicyStub.assertCan.mockImplementation((status) => {
      order.push(`assertCan:${status}`);
    });
    (updateOwnDataRepositoryStub.updateOwnData as jest.Mock).mockImplementation(
      async () => {
        order.push('persist');
      },
    );

    await sut.execute(makeParams({ gender: 'male' }));

    expect(order).toEqual([
      `assertCan:${EmployeeModel.Status.ACTIVE}`,
      'persist',
    ]);
    expect(ownDataPolicyStub.assertCan).toHaveBeenCalledWith(
      EmployeeModel.Status.ACTIVE,
    );
  });

  it('should propagate ActorAuthenticationFailedError from assertCan without applying or persisting', async () => {
    const {
      sut,
      ownDataPolicyStub,
      ownDataPatchService,
      updateOwnDataRepositoryStub,
      findOwnEmployeeStub,
    } = makeSut();
    ownDataPolicyStub.assertCan.mockImplementation(() => {
      throw new ActorAuthenticationFailedError();
    });
    const applySpy = jest.spyOn(ownDataPatchService, 'apply');

    await expect(
      sut.execute(makeParams({ phone: '+351 912 345 678' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(applySpy).not.toHaveBeenCalled();
    expect(updateOwnDataRepositoryStub.updateOwnData).not.toHaveBeenCalled();
    expect(findOwnEmployeeStub.findOwnEmployee).not.toHaveBeenCalled();
  });

  it('should persist when the Actor is on vacation', async () => {
    const actor = makeActorSnapshot({ status: EmployeeModel.Status.VACATION });
    const { sut, ownDataPolicyStub, updateOwnDataRepositoryStub } =
      makeSut(actor);

    await sut.execute(makeParams({ gender: 'male' }));

    expect(ownDataPolicyStub.assertCan).toHaveBeenCalledWith(
      EmployeeModel.Status.VACATION,
    );
    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      gender: 'male',
    });
  });

  it('should persist only the normalized phone', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ phone: '+351 912 345 678' }));

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      phone: '351912345678',
    });
    const payload = persistPayload(updateOwnDataRepositoryStub);
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('username');
    expect(payload).not.toHaveProperty('gender');
    expect(payload).not.toHaveProperty('languages');
    expect(payload).not.toHaveProperty('emergencyContact');
    expect(payload).not.toHaveProperty('nif');
    expect(payload).not.toHaveProperty('address');
  });

  it('should persist only the normalized name and leave email out of the payload', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ name: 'Ana Silva' }));

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      name: 'Ana Silva',
    });
    expect(persistPayload(updateOwnDataRepositoryStub)).not.toHaveProperty(
      'email',
    );
  });

  it('should persist a null username', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ username: null }));

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      username: null,
    });
  });

  it('should persist a trimmed username', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ username: '  joao  ' }));

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      username: 'joao',
    });
  });

  it('should persist a null nif as null rather than a number', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ nif: null }));

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      nif: null,
    });
    expect(persistPayload(updateOwnDataRepositoryStub).nif).toBeNull();
  });

  it('should persist nif as a string', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ nif: '123456789' }));

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      nif: '123456789',
    });
    expect(typeof persistPayload(updateOwnDataRepositoryStub).nif).toBe(
      'string',
    );
  });

  it('should persist gender', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ gender: 'male' }));

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      gender: 'male',
    });
  });

  it('should throw InvalidEmployeeGenderError and skip persist and re-read', async () => {
    const { sut, updateOwnDataRepositoryStub, findOwnEmployeeStub } = makeSut();

    await expect(
      sut.execute(makeParams({ gender: 'invalid' })),
    ).rejects.toBeInstanceOf(InvalidEmployeeGenderError);
    expect(updateOwnDataRepositoryStub.updateOwnData).not.toHaveBeenCalled();
    expect(findOwnEmployeeStub.findOwnEmployee).not.toHaveBeenCalled();
  });

  it('should throw InvalidNifError and not call updateOwnData when name is paired with an invalid nif', async () => {
    const { sut, updateOwnDataRepositoryStub, findOwnEmployeeStub } = makeSut();

    await expect(
      sut.execute(makeParams({ name: 'Ana Silva', nif: '00000000' })),
    ).rejects.toBeInstanceOf(InvalidNifError);
    expect(updateOwnDataRepositoryStub.updateOwnData).not.toHaveBeenCalled();
    expect(findOwnEmployeeStub.findOwnEmployee).not.toHaveBeenCalled();
  });

  it('should persist address alone', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(makeParams({ address: 'Rua B' })),
    ).resolves.toBeDefined();
    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      address: 'Rua B',
    });
  });

  it('should persist all eight writable keys with nif still a string and without email', async () => {
    const { sut, updateOwnDataRepositoryStub } = makeSut();

    await sut.execute(
      makeParams({
        name: 'Ana Silva',
        phone: '+351 912 345 678',
        username: '  joao  ',
        gender: 'male',
        languages: 'pt',
        emergencyContact: '+351 913 000 111',
        nif: '123456789',
        address: 'Rua B',
      }),
    );

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledWith({
      id: ACTOR_ID,
      name: 'Ana Silva',
      phone: '351912345678',
      username: 'joao',
      gender: 'male',
      languages: 'pt',
      emergencyContact: '351913000111',
      nif: '123456789',
      address: 'Rua B',
    });
    const payload = persistPayload(updateOwnDataRepositoryStub);
    expect(typeof payload.nif).toBe('string');
    expect(payload).not.toHaveProperty('email');
  });

  it('should throw EmptyOwnEmployeeDataError after the Actor check when every writable field is undefined', async () => {
    const {
      sut,
      findEmployeeByIdStub,
      ownDataPolicyStub,
      updateOwnDataRepositoryStub,
      findOwnEmployeeStub,
    } = makeSut();

    await expect(
      sut.execute(new UpdateOwnEmployeeDataDto({ actorId: ACTOR_ID })),
    ).rejects.toBeInstanceOf(EmptyOwnEmployeeDataError);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
    expect(ownDataPolicyStub.assertCan).toHaveBeenCalledWith(
      EmployeeModel.Status.ACTIVE,
    );
    expect(updateOwnDataRepositoryStub.updateOwnData).not.toHaveBeenCalled();
    expect(findOwnEmployeeStub.findOwnEmployee).not.toHaveBeenCalled();
  });

  it('should reconstitute via Password.fromHash, not Password.create or Employee.create', async () => {
    const { sut } = makeSut();
    const fromHashSpy = jest.spyOn(Password, 'fromHash');
    const createPasswordSpy = jest.spyOn(Password, 'create');
    const createEmployeeSpy = jest.spyOn(Employee, 'create');

    await sut.execute(makeParams({ gender: 'male' }));

    expect(fromHashSpy).toHaveBeenCalledWith(HASHED_PASSWORD);
    expect(createPasswordSpy).not.toHaveBeenCalled();
    expect(createEmployeeSpy).not.toHaveBeenCalled();
  });

  it('should return the read model resolved by findOwnEmployee', async () => {
    const { sut, readModel } = makeSut();

    const result = await sut.execute(makeParams({ gender: 'male' }));

    expect(result).toBe(readModel);
    expect(result).not.toEqual({ id: ACTOR_ID });
  });

  it('should call findOwnEmployee with actorId only after updateOwnData resolves', async () => {
    const { sut, updateOwnDataRepositoryStub, findOwnEmployeeStub, readModel } =
      makeSut();
    const calls: string[] = [];
    (updateOwnDataRepositoryStub.updateOwnData as jest.Mock).mockImplementation(
      async () => {
        calls.push('update-start');
        await Promise.resolve();
        calls.push('update-end');
      },
    );
    (findOwnEmployeeStub.findOwnEmployee as jest.Mock).mockImplementation(
      async () => {
        calls.push('read');
        return readModel;
      },
    );

    await sut.execute(makeParams({ gender: 'male' }));

    expect(calls).toEqual(['update-start', 'update-end', 'read']);
    expect(findOwnEmployeeStub.findOwnEmployee).toHaveBeenCalledTimes(1);
    expect(findOwnEmployeeStub.findOwnEmployee).toHaveBeenCalledWith(ACTOR_ID);
  });

  it('should throw a non-domain Error when findOwnEmployee returns null after a successful update', async () => {
    const { sut, updateOwnDataRepositoryStub, findOwnEmployeeStub } = makeSut();
    (findOwnEmployeeStub.findOwnEmployee as jest.Mock).mockResolvedValue(null);

    try {
      await sut.execute(makeParams({ gender: 'male' }));
      throw new Error('expected execute to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(DomainError);
      expect(error).not.toBeInstanceOf(ActorAuthenticationFailedError);
      expect((error as Error).message).not.toBe('expected execute to reject');
    }

    expect(updateOwnDataRepositoryStub.updateOwnData).toHaveBeenCalledTimes(1);
  });

  it('should depend on exactly five collaborators', () => {
    expect(UpdateOwnEmployeeDataUsecase.length).toBe(5);
  });

  it('should return a read model without password', async () => {
    const { sut, readModel } = makeSut();

    const result = await sut.execute(makeParams({ gender: 'male' }));

    expect(result).toBe(readModel);
    expect(result).not.toHaveProperty('password');
  });
});
