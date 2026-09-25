import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeNotFoundError,
  EmployeePersonalDataForbiddenError,
  EmptyPersonalEmployeeDataError,
  InvalidEmployeeGenderError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeePersonalDataPolicy } from '@modules/employees/domain/services/employee-personal-data.policy';
import { EmployeePersonalDataPatchService } from '@modules/employees/domain/services/employee-personal-data-patch.service';
import {
  InvalidNifError,
  InvalidPhoneFormatError,
  Password,
} from '@shared/domain/value-object';
import { UpdatePersonalEmployeeDataDto } from '../dtos/update-personal-employee-data.dto';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { UpdatePersonalEmployeeDataRepositoryPort } from '../ports/outbound/update-personal-employee-data-repository.port';
import { UpdatePersonalEmployeeDataUsecase } from './update-personal-employee-data.usecase';

const ACTOR_ID = '507f1f77bcf86cd799439022';
const TARGET_ID = '507f1f77bcf86cd799439011';
const HASHED_PASSWORD = '$2b$10$abcdefghijklmnopqrstuv';
const STORED_EMERGENCY_CONTACT = '351912000001';

const makeSnapshot = (
  overrides: Partial<EmployeeModel.toCreate> = {},
): EmployeeModel.toCreate => ({
  id: TARGET_ID,
  name: 'John Doe',
  email: 'john.doe@example.com',
  password: HASHED_PASSWORD,
  role: EmployeeModel.Role.EMPLOYEE,
  phone: null,
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
    gender: null,
    address: null,
    languages: null,
    nif: null,
    emergencyContact: null,
    ...overrides,
  });

type PersonalDataPolicyStub = {
  assertCan: jest.MockedFunction<EmployeePersonalDataPolicy['assertCan']>;
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
  const updatePersonalDataRepositoryStub: UpdatePersonalEmployeeDataRepositoryPort =
    {
      updatePersonalData: jest.fn().mockResolvedValue(undefined),
    };
  const personalDataPolicyStub: PersonalDataPolicyStub = {
    assertCan: jest.fn(),
  };

  return {
    findEmployeeByIdStub,
    updatePersonalDataRepositoryStub,
    personalDataPolicyStub,
  };
};

type SutTypes = {
  sut: UpdatePersonalEmployeeDataUsecase;
  findEmployeeByIdStub: FindEmployeeByIdPort;
  updatePersonalDataRepositoryStub: UpdatePersonalEmployeeDataRepositoryPort;
  personalDataPolicyStub: PersonalDataPolicyStub;
  personalDataPatchService: EmployeePersonalDataPatchService;
};

const makeSut = (
  actor: EmployeeModel.toCreate | null = makeActorSnapshot(),
  target: EmployeeModel.toCreate | null = makeSnapshot(),
): SutTypes => {
  const {
    findEmployeeByIdStub,
    updatePersonalDataRepositoryStub,
    personalDataPolicyStub,
  } = makeStubs(actor, target);
  const personalDataPatchService = new EmployeePersonalDataPatchService();
  const sut = new UpdatePersonalEmployeeDataUsecase(
    findEmployeeByIdStub,
    personalDataPolicyStub as unknown as EmployeePersonalDataPolicy,
    personalDataPatchService,
    updatePersonalDataRepositoryStub,
  );
  return {
    sut,
    findEmployeeByIdStub,
    updatePersonalDataRepositoryStub,
    personalDataPolicyStub,
    personalDataPatchService,
  };
};

const makeParams = (
  overrides: Partial<{
    actorId: string;
    id: string;
    gender?: string | null;
    languages?: string | null;
    emergencyContact?: string | null;
    nif?: string | null;
    address?: string | null;
  }> = {},
): UpdatePersonalEmployeeDataDto =>
  new UpdatePersonalEmployeeDataDto({
    actorId: ACTOR_ID,
    id: TARGET_ID,
    ...overrides,
  });

describe('UpdatePersonalEmployeeDataUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdatePersonalEmployeeDataUsecase);
  });

  it('should throw ActorAuthenticationFailedError when actorId is missing', async () => {
    const { sut, updatePersonalDataRepositoryStub, findEmployeeByIdStub } =
      makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when actorId is blank', async () => {
    const { sut, updatePersonalDataRepositoryStub, findEmployeeByIdStub } =
      makeSut();

    await expect(
      sut.execute(makeParams({ actorId: '   ' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).not.toHaveBeenCalled();
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should throw ActorAuthenticationFailedError when Actor findById returns null', async () => {
    const { sut, updatePersonalDataRepositoryStub, findEmployeeByIdStub } =
      makeSut(null, makeSnapshot());

    await expect(
      sut.execute(makeParams({ gender: 'male' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledWith(ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenCalledTimes(1);
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should throw EmployeeNotFoundError when Target findById returns null', async () => {
    const { sut, updatePersonalDataRepositoryStub, findEmployeeByIdStub } =
      makeSut(makeActorSnapshot(), null);

    await expect(
      sut.execute(makeParams({ gender: 'male' })),
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should call findById with actorId then target id', async () => {
    const { sut, findEmployeeByIdStub } = makeSut();

    await sut.execute(makeParams({ gender: 'male' }));

    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(1, ACTOR_ID);
    expect(findEmployeeByIdStub.findById).toHaveBeenNthCalledWith(2, TARGET_ID);
  });

  it('should call assertCan with reconstituted actor and target before persist', async () => {
    const { sut, personalDataPolicyStub, updatePersonalDataRepositoryStub } =
      makeSut();

    personalDataPolicyStub.assertCan.mockImplementation(({ actor, target }) => {
      expect(actor.toJSON().id).toBe(ACTOR_ID);
      expect(actor.toJSON().role).toBe(EmployeeModel.Role.ADMIN);
      expect(target.toJSON().id).toBe(TARGET_ID);
      expect(target.toJSON().gender).toBe('female');
      expect(target.toJSON().languages).toBe('en');
      expect(target.toJSON().address).toBe('old');
      expect(target.toJSON().nif).toBe('123456789');
      expect(target.toJSON().emergencyContact).toBe(STORED_EMERGENCY_CONTACT);
    });

    await sut.execute(makeParams({ gender: 'male' }));

    expect(personalDataPolicyStub.assertCan).toHaveBeenCalledTimes(1);
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalled();
  });

  it('should propagate EmployeePersonalDataForbiddenError from assertCan and not persist', async () => {
    const {
      sut,
      personalDataPolicyStub,
      updatePersonalDataRepositoryStub,
      personalDataPatchService,
    } = makeSut();
    const applySpy = jest.spyOn(personalDataPatchService, 'apply');
    personalDataPolicyStub.assertCan.mockImplementation(() => {
      throw new EmployeePersonalDataForbiddenError();
    });

    await expect(
      sut.execute(makeParams({ gender: 'male' })),
    ).rejects.toBeInstanceOf(EmployeePersonalDataForbiddenError);
    expect(applySpy).not.toHaveBeenCalled();
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should propagate ActorAuthenticationFailedError from assertCan and not persist', async () => {
    const {
      sut,
      personalDataPolicyStub,
      updatePersonalDataRepositoryStub,
      personalDataPatchService,
    } = makeSut();
    const applySpy = jest.spyOn(personalDataPatchService, 'apply');
    personalDataPolicyStub.assertCan.mockImplementation(() => {
      throw new ActorAuthenticationFailedError();
    });

    await expect(
      sut.execute(makeParams({ gender: 'male' })),
    ).rejects.toBeInstanceOf(ActorAuthenticationFailedError);
    expect(applySpy).not.toHaveBeenCalled();
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should propagate EmployeeAlreadyRemovedError from assertCan and not persist', async () => {
    const {
      sut,
      personalDataPolicyStub,
      updatePersonalDataRepositoryStub,
      personalDataPatchService,
    } = makeSut();
    const applySpy = jest.spyOn(personalDataPatchService, 'apply');
    personalDataPolicyStub.assertCan.mockImplementation(() => {
      throw new EmployeeAlreadyRemovedError();
    });

    await expect(
      sut.execute(makeParams({ gender: 'male' })),
    ).rejects.toBeInstanceOf(EmployeeAlreadyRemovedError);
    expect(applySpy).not.toHaveBeenCalled();
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should persist gender only and not send other personal fields from snapshot', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    const result = await sut.execute(makeParams({ gender: 'male' }));

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      gender: 'male',
    });
    const persistPayload = (
      updatePersonalDataRepositoryStub.updatePersonalData as jest.Mock
    ).mock.calls[0][0];
    expect(persistPayload).not.toHaveProperty('address');
    expect(persistPayload).not.toHaveProperty('languages');
    expect(persistPayload).not.toHaveProperty('nif');
    expect(persistPayload).not.toHaveProperty('emergencyContact');
    expect(result).toEqual({ id: TARGET_ID });
  });

  it('should persist gender null when gender is null', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ gender: null }));

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      gender: null,
    });
  });

  it('should throw InvalidEmployeeGenderError for invalid gender and not persist', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(makeParams({ gender: 'invalid' })),
    ).rejects.toBeInstanceOf(InvalidEmployeeGenderError);
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should throw InvalidEmployeeGenderError for empty gender and not persist', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(makeParams({ gender: '' })),
    ).rejects.toBeInstanceOf(InvalidEmployeeGenderError);
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should persist nif null when nif is null', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ nif: null }));

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      nif: null,
    });
  });

  it('should persist nif as string when nif is provided', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ nif: '123456789' }));

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      nif: '123456789',
    });
    const persistPayload = (
      updatePersonalDataRepositoryStub.updatePersonalData as jest.Mock
    ).mock.calls[0][0];
    expect(typeof persistPayload.nif).toBe('string');
  });

  it('should throw InvalidNifError for invalid nif and not persist', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(makeParams({ nif: '00000000' })),
    ).rejects.toBeInstanceOf(InvalidNifError);
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should persist emergencyContact null when emergencyContact is null', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ emergencyContact: null }));

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      emergencyContact: null,
    });
  });

  it('should persist normalized emergencyContact when valid', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(
      makeParams({
        emergencyContact: '+351 912 345 678',
      }),
    );

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      emergencyContact: '351912345678',
    });
  });

  it('should throw InvalidPhoneFormatError for invalid emergencyContact and not persist', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(makeParams({ emergencyContact: '123' })),
    ).rejects.toBeInstanceOf(InvalidPhoneFormatError);
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should persist languages string', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ languages: 'Português' }));

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      languages: 'Português',
    });
  });

  it('should persist languages null when languages is null', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ languages: null }));

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      languages: null,
    });
  });

  it('should persist address when address is provided', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(makeParams({ address: 'Rua X' }));

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      address: 'Rua X',
    });
  });

  it('should persist all five personal fields when all are present', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await sut.execute(
      makeParams({
        gender: 'male',
        languages: 'pt',
        emergencyContact: '+351 912 111 222',
        nif: '123456789',
        address: 'New address',
      }),
    );

    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).toHaveBeenCalledWith({
      id: TARGET_ID,
      gender: 'male',
      languages: 'pt',
      emergencyContact: '351912111222',
      nif: '123456789',
      address: 'New address',
    });
    const persistPayload = (
      updatePersonalDataRepositoryStub.updatePersonalData as jest.Mock
    ).mock.calls[0][0];
    expect(typeof persistPayload.nif).toBe('string');
  });

  it('should throw EmptyPersonalEmployeeDataError when no personal keys are present and not persist', async () => {
    const { sut, updatePersonalDataRepositoryStub } = makeSut();

    await expect(
      sut.execute(
        new UpdatePersonalEmployeeDataDto({
          actorId: ACTOR_ID,
          id: TARGET_ID,
        }),
      ),
    ).rejects.toBeInstanceOf(EmptyPersonalEmployeeDataError);
    expect(
      updatePersonalDataRepositoryStub.updatePersonalData,
    ).not.toHaveBeenCalled();
  });

  it('should reconstitute via Password.fromHash, not Password.create', async () => {
    const { sut } = makeSut();
    const fromHashSpy = jest.spyOn(Password, 'fromHash');
    const createSpy = jest.spyOn(Password, 'create');

    await sut.execute(makeParams({ gender: 'male' }));

    expect(fromHashSpy).toHaveBeenCalledWith(HASHED_PASSWORD);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should not depend on Encrypter, CompareHashPort, or EmployeeLifecyclePolicy', () => {
    expect(UpdatePersonalEmployeeDataUsecase.length).toBe(4);
  });
});
