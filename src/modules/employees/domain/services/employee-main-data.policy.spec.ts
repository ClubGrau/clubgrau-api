import { Email, Name, Password } from '@shared/domain/value-object';
import { Employee, ReconstituteEmployeeProps } from '../entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeMainDataForbiddenError,
} from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { EmployeeMainDataPolicy } from './employee-main-data.policy';

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

const makeSut = (): EmployeeMainDataPolicy => new EmployeeMainDataPolicy();

describe('EmployeeMainDataPolicy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const sut = makeSut();
    expect(sut).toBeInstanceOf(EmployeeMainDataPolicy);
  });

  describe('Rule 1: Actor must be login-capable (ACTIVE or VACATION)', () => {
    it('should throw ActorAuthenticationFailedError when actor is INACTIVE', () => {
      const sut = makeSut();
      const actor = makeEmployee({
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });
      const target = makeEmployee({ id: FIXED_ID_2 });

      expect(() => sut.assertCan({ actor, target })).toThrow(
        ActorAuthenticationFailedError,
      );
    });

    it('should throw ActorAuthenticationFailedError when actor is REMOVED', () => {
      const sut = makeSut();
      const actor = makeEmployee({
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.REMOVED,
      });
      const target = makeEmployee({ id: FIXED_ID_2 });

      expect(() => sut.assertCan({ actor, target })).toThrow(
        ActorAuthenticationFailedError,
      );
    });

    it('should allow actor on VACATION when matrix otherwise allows', () => {
      const sut = makeSut();
      const actor = makeEmployee({
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.VACATION,
      });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
      });

      expect(() => sut.assertCan({ actor, target })).not.toThrow();
    });

    it('should throw ActorAuthenticationFailedError before Target Removed when actor is INACTIVE', () => {
      const sut = makeSut();
      const actor = makeEmployee({
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });
      const target = makeEmployee({
        id: FIXED_ID_2,
        status: EmployeeModel.Status.REMOVED,
      });

      expect(() => sut.assertCan({ actor, target })).toThrow(
        ActorAuthenticationFailedError,
      );
    });
  });

  describe('Rule 2: Target must not be REMOVED', () => {
    it('should throw EmployeeAlreadyRemovedError when target is REMOVED', () => {
      const sut = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        status: EmployeeModel.Status.REMOVED,
      });

      expect(() => sut.assertCan({ actor, target })).toThrow(
        EmployeeAlreadyRemovedError,
      );
    });
  });

  describe('Rule 3: Role matrix — EMPLOYEE actor', () => {
    it.each<EmployeeModel.Role>([
      EmployeeModel.Role.EMPLOYEE,
      EmployeeModel.Role.MANAGER,
      EmployeeModel.Role.ADMIN,
    ])(
      'should throw EmployeeMainDataForbiddenError when EMPLOYEE actor targets %s',
      (targetRole) => {
        const sut = makeSut();
        const actor = makeEmployee({ role: EmployeeModel.Role.EMPLOYEE });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: targetRole,
        });

        expect(() => sut.assertCan({ actor, target })).toThrow(
          EmployeeMainDataForbiddenError,
        );
      },
    );
  });

  describe('Rule 4: Role matrix — MANAGER actor', () => {
    it('should allow MANAGER to update an EMPLOYEE target with a different id', () => {
      const sut = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
      });

      expect(() => sut.assertCan({ actor, target })).not.toThrow();
    });

    it('should throw EmployeeMainDataForbiddenError when MANAGER tries to update themselves', () => {
      const sut = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: actor.id,
        role: EmployeeModel.Role.EMPLOYEE,
      });

      expect(() => sut.assertCan({ actor, target })).toThrow(
        EmployeeMainDataForbiddenError,
      );
    });

    it('should throw EmployeeMainDataForbiddenError when MANAGER targets another MANAGER', () => {
      const sut = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.MANAGER,
      });

      expect(() => sut.assertCan({ actor, target })).toThrow(
        EmployeeMainDataForbiddenError,
      );
    });

    it('should throw EmployeeMainDataForbiddenError when MANAGER targets an ADMIN', () => {
      const sut = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
      });

      expect(() => sut.assertCan({ actor, target })).toThrow(
        EmployeeMainDataForbiddenError,
      );
    });
  });

  describe('Rule 5: Role matrix — ADMIN actor', () => {
    it.each<EmployeeModel.Role>([
      EmployeeModel.Role.EMPLOYEE,
      EmployeeModel.Role.MANAGER,
      EmployeeModel.Role.ADMIN,
    ])(
      'should allow ADMIN to update a %s target with a different id',
      (targetRole) => {
        const sut = makeSut();
        const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: targetRole,
        });

        expect(() => sut.assertCan({ actor, target })).not.toThrow();
      },
    );

    it('should allow ADMIN to update themselves', () => {
      const sut = makeSut();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: actor.id,
        role: EmployeeModel.Role.ADMIN,
      });

      expect(() => sut.assertCan({ actor, target })).not.toThrow();
    });

    it.each<EmployeeModel.Status>([
      EmployeeModel.Status.INACTIVE,
      EmployeeModel.Status.VACATION,
    ])(
      'should allow ADMIN to update a target with status %s',
      (targetStatus) => {
        const sut = makeSut();
        const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
        const target = makeEmployee({
          id: FIXED_ID_2,
          status: targetStatus,
        });

        expect(() => sut.assertCan({ actor, target })).not.toThrow();
      },
    );
  });
});
