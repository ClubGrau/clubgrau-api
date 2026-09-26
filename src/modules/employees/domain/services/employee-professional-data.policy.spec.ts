import { Email, Name, Password } from '@shared/domain/value-object';
import { Employee, ReconstituteEmployeeProps } from '../entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeProfessionalDataForbiddenError,
  LastAdminProtectedError,
} from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { CountLoginCapableAdminsPort } from '../ports/count-login-capable-admins.port';
import { CountNonRemovedAdminsPort } from '../ports/count-non-removed-admins.port';
import { EmployeeProfessionalDataPolicy } from './employee-professional-data.policy';

const FIXED_ID = '507f1f77bcf86cd799439011';
const FIXED_ID_2 = '507f1f77bcf86cd799439022';

const makeEmployee = (
  overrides: Partial<ReconstituteEmployeeProps> & { id?: string } = {},
): Employee => {
  const id = overrides.id ?? FIXED_ID;
  return Employee.reconstitute({
    id,
    name: Name.create('John Doe'),
    email: Email.create('john@example.com'),
    password: Password.fromHash('$2b$10$hashedvalue'),
    phone: null,
    nif: null,
    role: EmployeeModel.Role.EMPLOYEE,
    status: EmployeeModel.Status.ACTIVE,
    createdAt: new Date(),
    deactivateAt: null,
    ...overrides,
  });
};

type CountAdminsPort = CountLoginCapableAdminsPort & CountNonRemovedAdminsPort;

type SutTypes = {
  sut: EmployeeProfessionalDataPolicy;
  countPort: jest.Mocked<CountAdminsPort>;
};

const makeSut = (): SutTypes => {
  const countPort: jest.Mocked<CountAdminsPort> = {
    countLoginCapableAdmins: jest.fn().mockResolvedValue(2),
    countNonRemovedAdmins: jest.fn().mockResolvedValue(2),
  };
  const sut = new EmployeeProfessionalDataPolicy(countPort);
  return { sut, countPort };
};

const expectNoCount = (countPort: jest.Mocked<CountAdminsPort>): void => {
  expect(countPort.countLoginCapableAdmins).not.toHaveBeenCalled();
  expect(countPort.countNonRemovedAdmins).not.toHaveBeenCalled();
};

describe('EmployeeProfessionalDataPolicy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeInstanceOf(EmployeeProfessionalDataPolicy);
  });

  describe('matrix without a Role delta', () => {
    it.each<EmployeeModel.Role>([
      EmployeeModel.Role.EMPLOYEE,
      EmployeeModel.Role.MANAGER,
      EmployeeModel.Role.ADMIN,
    ])(
      'should allow ADMIN to update a %s target and not call counts',
      async (targetRole) => {
        const { sut, countPort } = makeSut();
        const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: targetRole,
        });

        await expect(
          sut.assertCan({ actor, target, roleChange: false }),
        ).resolves.toBeUndefined();
        expectNoCount(countPort);
      },
    );

    it('should allow ADMIN to update themselves and not call counts', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: actor.id,
        role: EmployeeModel.Role.ADMIN,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should allow MANAGER to update an EMPLOYEE target with a different id', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should throw EmployeeProfessionalDataForbiddenError when MANAGER updates themselves', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: actor.id,
        role: EmployeeModel.Role.EMPLOYEE,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).rejects.toBeInstanceOf(EmployeeProfessionalDataForbiddenError);
      expectNoCount(countPort);
    });

    it('should throw EmployeeProfessionalDataForbiddenError when MANAGER targets another MANAGER', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.MANAGER,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).rejects.toBeInstanceOf(EmployeeProfessionalDataForbiddenError);
      expectNoCount(countPort);
    });

    it('should throw EmployeeProfessionalDataForbiddenError when MANAGER targets an ADMIN', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).rejects.toBeInstanceOf(EmployeeProfessionalDataForbiddenError);
      expectNoCount(countPort);
    });

    it.each<EmployeeModel.Role>([
      EmployeeModel.Role.EMPLOYEE,
      EmployeeModel.Role.MANAGER,
      EmployeeModel.Role.ADMIN,
    ])(
      'should throw EmployeeProfessionalDataForbiddenError when EMPLOYEE actor targets %s',
      async (targetRole) => {
        const { sut, countPort } = makeSut();
        const actor = makeEmployee({ role: EmployeeModel.Role.EMPLOYEE });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: targetRole,
        });

        await expect(
          sut.assertCan({ actor, target, roleChange: false }),
        ).rejects.toBeInstanceOf(EmployeeProfessionalDataForbiddenError);
        expectNoCount(countPort);
      },
    );
  });

  describe('actor login-capable and target status', () => {
    it('should allow an actor on VACATION when the matrix otherwise allows', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.VACATION,
      });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should throw ActorAuthenticationFailedError when actor is INACTIVE', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });
      const target = makeEmployee({ id: FIXED_ID_2 });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).rejects.toThrow(ActorAuthenticationFailedError);
      expectNoCount(countPort);
    });

    it('should throw ActorAuthenticationFailedError when actor is REMOVED', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.REMOVED,
      });
      const target = makeEmployee({ id: FIXED_ID_2 });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).rejects.toThrow(ActorAuthenticationFailedError);
      expectNoCount(countPort);
    });

    it('should throw EmployeeAlreadyRemovedError when target is REMOVED', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        status: EmployeeModel.Status.REMOVED,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).rejects.toThrow(EmployeeAlreadyRemovedError);
      expectNoCount(countPort);
    });

    it('should allow an INACTIVE target when the actor is ADMIN', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should allow a VACATION target when the actor is ADMIN', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        status: EmployeeModel.Status.VACATION,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should throw ActorAuthenticationFailedError before Target Removed when actor is INACTIVE', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });
      const target = makeEmployee({
        id: FIXED_ID_2,
        status: EmployeeModel.Status.REMOVED,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).rejects.toThrow(ActorAuthenticationFailedError);
      expectNoCount(countPort);
    });
  });

  describe('role delta', () => {
    it('should throw EmployeeProfessionalDataForbiddenError when MANAGER changes role and not call counts', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: true }),
      ).rejects.toBeInstanceOf(EmployeeProfessionalDataForbiddenError);
      expectNoCount(countPort);
    });

    it('should allow ADMIN to promote an EMPLOYEE and not call counts', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: true }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should allow ADMIN to change a MANAGER to EMPLOYEE and not call counts', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.MANAGER,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: true }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should allow ADMIN to change another ADMIN when both counts are above one', async () => {
      const { sut, countPort } = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: true }),
      ).resolves.toBeUndefined();
      expect(countPort.countLoginCapableAdmins).toHaveBeenCalledTimes(1);
      expect(countPort.countNonRemovedAdmins).toHaveBeenCalledTimes(1);
    });

    it('should throw LastAdminProtectedError when the only login-capable ADMIN leaves ADMIN and not count non-removed', async () => {
      const { sut, countPort } = makeSut();
      countPort.countLoginCapableAdmins.mockResolvedValue(1);
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: true }),
      ).rejects.toThrow(LastAdminProtectedError);
      expect(countPort.countLoginCapableAdmins).toHaveBeenCalledTimes(1);
      expect(countPort.countNonRemovedAdmins).not.toHaveBeenCalled();
    });

    it('should throw LastAdminProtectedError when login-capable admins remain but the target is the last non-removed ADMIN', async () => {
      const { sut, countPort } = makeSut();
      countPort.countLoginCapableAdmins.mockResolvedValue(2);
      countPort.countNonRemovedAdmins.mockResolvedValue(1);
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: true }),
      ).rejects.toThrow(LastAdminProtectedError);
      expect(countPort.countLoginCapableAdmins).toHaveBeenCalledTimes(1);
      expect(countPort.countNonRemovedAdmins).toHaveBeenCalledTimes(1);
    });

    it('should throw LastAdminProtectedError when the only login-capable ADMIN is on VACATION and leaves ADMIN', async () => {
      const { sut, countPort } = makeSut();
      countPort.countLoginCapableAdmins.mockResolvedValue(1);
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.VACATION,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: true }),
      ).rejects.toThrow(LastAdminProtectedError);
      expect(countPort.countNonRemovedAdmins).not.toHaveBeenCalled();
    });

    it('should allow a Job Title-only change on a Last Admin target and not call counts', async () => {
      const { sut, countPort } = makeSut();
      countPort.countLoginCapableAdmins.mockResolvedValue(1);
      countPort.countNonRemovedAdmins.mockResolvedValue(1);
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should never call counts when roleChange is false even if the target is the last ADMIN', async () => {
      const { sut, countPort } = makeSut();
      countPort.countLoginCapableAdmins.mockResolvedValue(1);
      countPort.countNonRemovedAdmins.mockResolvedValue(1);
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.VACATION,
      });

      await expect(
        sut.assertCan({ actor, target, roleChange: false }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });
  });
});
