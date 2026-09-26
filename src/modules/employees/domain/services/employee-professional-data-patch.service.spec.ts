import { Email, Name, Password } from '@shared/domain/value-object';
import { Employee, ReconstituteEmployeeProps } from '../entities/Employee';
import { InvalidEmployeeRoleError } from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { EmployeeProfessionalDataPatchService } from './employee-professional-data-patch.service';

const FIXED_ID = '507f1f77bcf86cd799439011';

const makeTarget = (
  overrides: Partial<ReconstituteEmployeeProps> = {},
): Employee =>
  Employee.reconstitute({
    id: FIXED_ID,
    name: Name.create('John Doe'),
    email: Email.create('john@example.com'),
    password: Password.fromHash('$2b$10$hashedvalue'),
    phone: null,
    nif: null,
    role: EmployeeModel.Role.EMPLOYEE,
    status: EmployeeModel.Status.ACTIVE,
    createdAt: new Date(),
    deactivateAt: null,
    jobTitle: 'Cabeleireiro',
    ...overrides,
  });

const makeSut = (): EmployeeProfessionalDataPatchService =>
  new EmployeeProfessionalDataPatchService();

describe('EmployeeProfessionalDataPatchService', () => {
  describe('jobTitle', () => {
    it('should apply a job title and return it on the persist patch', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { jobTitle: 'Barbeiro' });

      expect(patch).toEqual({ jobTitle: 'Barbeiro' });
      expect(target.toJSON().jobTitle).toBe('Barbeiro');
    });

    it('should clear job title when null', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { jobTitle: null });

      expect(patch).toEqual({ jobTitle: null });
      expect(target.toJSON().jobTitle).toBeNull();
    });

    it.each(['', '   '])(
      'should clear job title when the value is blank (%j)',
      (jobTitle) => {
        const sut = makeSut();
        const target = makeTarget();

        const patch = sut.apply(target, { jobTitle });

        expect(patch).toEqual({ jobTitle: null });
        expect(target.toJSON().jobTitle).toBeNull();
      },
    );

    it('should still persist job title when the string equals the current value', () => {
      const sut = makeSut();
      const target = makeTarget({ jobTitle: 'Barbeiro' });

      const patch = sut.apply(target, { jobTitle: 'Barbeiro' });

      expect(patch).toEqual({ jobTitle: 'Barbeiro' });
      expect(target.toJSON().jobTitle).toBe('Barbeiro');
    });
  });

  describe('role', () => {
    it('should omit an echoed role and not call changeRole', () => {
      const sut = makeSut();
      const target = makeTarget();
      const changeRole = jest.spyOn(target, 'changeRole');

      const patch = sut.apply(target, { role: EmployeeModel.Role.EMPLOYEE });

      expect(patch).toEqual({});
      expect(changeRole).not.toHaveBeenCalled();
      expect(target.toJSON().role).toBe(EmployeeModel.Role.EMPLOYEE);
    });

    it('should apply a different role and include it on the persist patch', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { role: EmployeeModel.Role.MANAGER });

      expect(patch).toEqual({ role: EmployeeModel.Role.MANAGER });
      expect(target.toJSON().role).toBe(EmployeeModel.Role.MANAGER);
    });

    it('should throw InvalidEmployeeRoleError for a non-enum role and leave the role unchanged', () => {
      const sut = makeSut();
      const target = makeTarget();

      expect(() =>
        sut.apply(target, {
          role: 'ROOT' as unknown as EmployeeModel.Role,
        }),
      ).toThrow(InvalidEmployeeRoleError);
      expect(target.toJSON().role).toBe(EmployeeModel.Role.EMPLOYEE);
    });
  });

  describe('combined changes', () => {
    it('should persist only job title when role is echoed', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, {
        jobTitle: 'Barbeiro',
        role: EmployeeModel.Role.EMPLOYEE,
      });

      expect(patch).toEqual({ jobTitle: 'Barbeiro' });
      expect(target.toJSON().jobTitle).toBe('Barbeiro');
      expect(target.toJSON().role).toBe(EmployeeModel.Role.EMPLOYEE);
    });

    it('should persist job title and role when both change', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, {
        jobTitle: 'Barbeiro',
        role: EmployeeModel.Role.MANAGER,
      });

      expect(patch).toEqual({
        jobTitle: 'Barbeiro',
        role: EmployeeModel.Role.MANAGER,
      });
      expect(target.toJSON().jobTitle).toBe('Barbeiro');
      expect(target.toJSON().role).toBe(EmployeeModel.Role.MANAGER);
    });

    it('should return an empty patch and leave professional fields unchanged', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, {});

      expect(patch).toEqual({});
      expect(target.toJSON().jobTitle).toBe('Cabeleireiro');
      expect(target.toJSON().role).toBe(EmployeeModel.Role.EMPLOYEE);
      expect(target.toJSON().employmentId).toBeNull();
    });
  });
});
