import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import {
  EmployeeAlreadyActiveError,
  EmployeeAlreadyInactiveError,
  EmployeeAlreadyOnVacationError,
  EmployeeNotFoundError,
  InvalidEmployeeStatusError,
} from '@modules/employees/domain/errors/employee.errors';
import { Password } from '@shared/domain/value-object';
import { UpdateEmployeeStatusDto } from '../dtos/update-employee-status.dto';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { UpdateEmployeeStatusRepositoryPort } from '../ports/outbound/update-employee-status-repository.port';
import { UpdateEmployeeStatusUsecase } from './update-employee-status.usecase';

const VALID_EMPLOYEE_ID = '507f1f77bcf86cd799439011';
const HASHED_PASSWORD = '$2b$10$abcdefghijklmnopqrstuv';

const makeSnapshot = (
  overrides: Partial<EmployeeModel.toCreate> = {},
): EmployeeModel.toCreate => ({
  id: VALID_EMPLOYEE_ID,
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
  ...overrides,
});

const makeStubs = (snapshot: EmployeeModel.toCreate = makeSnapshot()) => ({
  findEmployeeByIdStub: {
    findById: jest.fn().mockResolvedValue(snapshot),
  } satisfies FindEmployeeByIdPort,
  updateEmployeeStatusRepositoryStub: {
    updateStatus: jest.fn().mockResolvedValue(undefined),
  } satisfies UpdateEmployeeStatusRepositoryPort,
});

const makeSut = (
  snapshot: EmployeeModel.toCreate = makeSnapshot(),
): SutTypes => {
  const { findEmployeeByIdStub, updateEmployeeStatusRepositoryStub } =
    makeStubs(snapshot);
  const sut = new UpdateEmployeeStatusUsecase(
    findEmployeeByIdStub,
    updateEmployeeStatusRepositoryStub,
  );
  return {
    sut,
    findEmployeeByIdStub,
    updateEmployeeStatusRepositoryStub,
  };
};

const makeParams = (
  overrides: Partial<UpdateEmployeeStatusDto> = {},
): UpdateEmployeeStatusDto => ({
  id: VALID_EMPLOYEE_ID,
  status: EmployeeModel.Status.INACTIVE,
  ...overrides,
});

type SutTypes = {
  sut: UpdateEmployeeStatusUsecase;
  findEmployeeByIdStub: FindEmployeeByIdPort;
  updateEmployeeStatusRepositoryStub: UpdateEmployeeStatusRepositoryPort;
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

  it('should throw EmployeeNotFoundError when findById returns null', async () => {
    const { sut, findEmployeeByIdStub, updateEmployeeStatusRepositoryStub } =
      makeSut();
    jest.spyOn(findEmployeeByIdStub, 'findById').mockResolvedValueOnce(null);
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await expect(sut.execute(makeParams())).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should call findById with the given id', async () => {
    const { sut, findEmployeeByIdStub } = makeSut();
    const findByIdSpy = jest.spyOn(findEmployeeByIdStub, 'findById');

    await sut.execute(makeParams());

    expect(findByIdSpy).toHaveBeenCalledWith(VALID_EMPLOYEE_ID);
  });

  it('should deactivate an ACTIVE employee and persist INACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut();
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    const result = await sut.execute(makeParams());

    expect(updateSpy).toHaveBeenCalledWith({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
      deactivateAt: expect.any(Date),
    });
    expect(result).toEqual({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
  });

  it('should activate an INACTIVE employee and persist ACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeSnapshot({
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt: new Date('2024-06-01T00:00:00.000Z'),
      }),
    );
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    const result = await sut.execute(
      makeParams({ status: EmployeeModel.Status.ACTIVE }),
    );

    expect(updateSpy).toHaveBeenCalledWith({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.ACTIVE,
      deactivateAt: null,
    });
    expect(result).toEqual({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.ACTIVE,
    });
  });

  it('should put an ACTIVE employee on vacation and persist VACATION', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut();
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    const result = await sut.execute(
      makeParams({ status: EmployeeModel.Status.VACATION }),
    );

    expect(updateSpy).toHaveBeenCalledWith({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.VACATION,
      deactivateAt: null,
    });
    expect(result).toEqual({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.VACATION,
    });
  });

  it('should persist INACTIVE → VACATION', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeSnapshot({
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt: new Date('2024-06-01T00:00:00.000Z'),
      }),
    );
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await sut.execute(makeParams({ status: EmployeeModel.Status.VACATION }));

    expect(updateSpy).toHaveBeenCalledWith({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.VACATION,
      deactivateAt: null,
    });
  });

  it('should persist VACATION → INACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeSnapshot({ status: EmployeeModel.Status.VACATION }),
    );
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await sut.execute(makeParams({ status: EmployeeModel.Status.INACTIVE }));

    expect(updateSpy).toHaveBeenCalledWith({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
      deactivateAt: expect.any(Date),
    });
  });

  it('should persist VACATION → ACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeSnapshot({ status: EmployeeModel.Status.VACATION }),
    );
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await sut.execute(makeParams({ status: EmployeeModel.Status.ACTIVE }));

    expect(updateSpy).toHaveBeenCalledWith({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.ACTIVE,
      deactivateAt: null,
    });
  });

  it('should throw EmployeeAlreadyActiveError when already ACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut();
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await expect(
      sut.execute(makeParams({ status: EmployeeModel.Status.ACTIVE })),
    ).rejects.toBeInstanceOf(EmployeeAlreadyActiveError);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should throw EmployeeAlreadyInactiveError when already INACTIVE', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeSnapshot({
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt: new Date('2024-06-01T00:00:00.000Z'),
      }),
    );
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await expect(
      sut.execute(makeParams({ status: EmployeeModel.Status.INACTIVE })),
    ).rejects.toBeInstanceOf(EmployeeAlreadyInactiveError);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should throw EmployeeAlreadyOnVacationError when already VACATION', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeSnapshot({ status: EmployeeModel.Status.VACATION }),
    );
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await expect(
      sut.execute(makeParams({ status: EmployeeModel.Status.VACATION })),
    ).rejects.toBeInstanceOf(EmployeeAlreadyOnVacationError);
    expect(updateSpy).not.toHaveBeenCalled();
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
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
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
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
  });

  it('should throw InvalidEmployeeStatusError and not persist when status is REMOVED', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeSnapshot({ status: EmployeeModel.Status.INACTIVE }),
    );
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await expect(
      sut.execute(makeParams({ status: EmployeeModel.Status.REMOVED })),
    ).rejects.toBeInstanceOf(InvalidEmployeeStatusError);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should throw InvalidEmployeeStatusError for an unknown status value (exhaustiveness guard)', async () => {
    const { sut, updateEmployeeStatusRepositoryStub } = makeSut(
      makeSnapshot({ status: EmployeeModel.Status.ACTIVE }),
    );
    const updateSpy = jest.spyOn(
      updateEmployeeStatusRepositoryStub,
      'updateStatus',
    );

    await expect(
      sut.execute(
        makeParams({ status: 'UNKNOWN' as unknown as EmployeeModel.Status }),
      ),
    ).rejects.toBeInstanceOf(InvalidEmployeeStatusError);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
