import { Email, Name, Nif, Password, Phone } from '@shared/domain/value-object';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPasswordError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { EmployeeModel } from '../models/employee.model';
import {
  EmployeeAlreadyActiveError,
  EmployeeAlreadyInactiveError,
  InvalidEmployeeRoleError,
} from '../errors/employee.errors';
import { Employee } from './Employee';
import type { ReconstituteEmployeeProps } from './Employee';

const HEX_24 = /^[0-9a-f]{24}$/;

const makeValidProps = () => ({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'Str0ng!Pass',
  role: EmployeeModel.Role.EMPLOYEE,
});

const makeSnapshot = (
  overrides: Partial<ReconstituteEmployeeProps> = {},
): ReconstituteEmployeeProps => ({
  id: '507f1f77bcf86cd799439011',
  name: Name.create('Jane Doe'),
  email: Email.create('jane@example.com'),
  password: Password.fromHash('$2b$10$hashedvalue'),
  phone: null,
  nif: null,
  role: EmployeeModel.Role.MANAGER,
  isActive: true,
  createdAt: new Date(),
  deactivateAt: null,
  ...overrides,
});

describe('Employee (entity)', () => {
  describe('create', () => {
    it('should create a valid employee with sensible defaults', () => {
      const employee = Employee.create(makeValidProps());
      const json = employee.toJSON();

      expect(employee.id).toMatch(HEX_24);
      expect(json.id).toBe(employee.id);
      expect(json.name).toBe('John Doe');
      expect(json.email).toBe('john@example.com');
      expect(json.password).toBe('[REDACTED]');
      expect(json.role).toBe(EmployeeModel.Role.EMPLOYEE);
      expect(json.phone).toBeNull();
      expect(json.nif).toBeNull();
      expect(json.isActive).toBe(true);
      expect(json.deactivateAt).toBeNull();
      expect(json.createdAt).toBeInstanceOf(Date);
    });

    it('should return a fully plain object from toJSON()', () => {
      const employee = Employee.create(makeValidProps());
      const json = employee.toJSON();

      expect(typeof json.name).toBe('string');
      expect(typeof json.email).toBe('string');
      expect(typeof json.password).toBe('string');
    });

    it('should generate unique ids when none is provided', () => {
      const a = Employee.create(makeValidProps());
      const b = Employee.create(makeValidProps());
      expect(a.id).not.toBe(b.id);
    });

    it('should accept an optional phone', () => {
      const employee = Employee.create({
        ...makeValidProps(),
        phone: '+351 912 345 678',
      });
      expect(employee.toJSON().phone).toBe('351912345678');
    });

    it('should accept an optional NIF', () => {
      const employee = Employee.create({
        ...makeValidProps(),
        nif: 123456789,
      });
      expect(employee.toJSON().nif).toBe('123456789');
    });

    it('should throw for an invalid role', () => {
      expect(() =>
        Employee.create({
          ...makeValidProps(),
          role: 'ROOT' as unknown as EmployeeModel.Role,
        }),
      ).toThrow(InvalidEmployeeRoleError);
    });

    it('should throw for an invalid name', () => {
      expect(() => Employee.create({ ...makeValidProps(), name: 'A' })).toThrow(
        InvalidNameError,
      );
    });

    it('should throw for an invalid email', () => {
      expect(() =>
        Employee.create({ ...makeValidProps(), email: 'not-an-email' }),
      ).toThrow(InvalidEmailError);
    });

    it('should throw for an invalid phone', () => {
      expect(() =>
        Employee.create({ ...makeValidProps(), phone: '123' }),
      ).toThrow(InvalidPhoneFormatError);
    });

    it('should throw for a weak password', () => {
      expect(() =>
        Employee.create({ ...makeValidProps(), password: 'weak' }),
      ).toThrow(InvalidPasswordError);
    });
  });

  describe('reconstitute', () => {
    it('should rebuild an employee from a full snapshot', () => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const deactivateAt = new Date('2024-06-01T00:00:00.000Z');

      const employee = Employee.reconstitute(
        makeSnapshot({
          phone: Phone.create('+351 912 345 678'),
          nif: Nif.create('123456789'),
          isActive: false,
          createdAt,
          deactivateAt,
        }),
      );

      const json = employee.toJSON();
      expect(employee.id).toBe('507f1f77bcf86cd799439011');
      expect(json.role).toBe(EmployeeModel.Role.MANAGER);
      expect(json.isActive).toBe(false);
      expect(json.phone).toBe('351912345678');
      expect(json.nif).toBe('123456789');
      expect(json.password).toBe('[REDACTED]');
      expect(employee.props.password.isHashed).toBe(true);
      expect(json.createdAt).toBe(createdAt);
      expect(json.deactivateAt).toBe(deactivateAt);
    });
  });

  describe('deactivate', () => {
    it('should deactivate an active employee and set deactivateAt', () => {
      const employee = Employee.create(makeValidProps());

      employee.deactivate();

      expect(employee.toJSON().isActive).toBe(false);
      expect(employee.toJSON().deactivateAt).toBeInstanceOf(Date);
    });

    it('should throw when deactivating an already inactive employee', () => {
      const employee = Employee.create(makeValidProps());
      employee.deactivate();

      expect(() => employee.deactivate()).toThrow(EmployeeAlreadyInactiveError);
    });
  });

  describe('activate', () => {
    it('should reactivate an inactive employee and clear deactivateAt', () => {
      const employee = Employee.create(makeValidProps());
      employee.deactivate();

      employee.activate();

      expect(employee.toJSON().isActive).toBe(true);
      expect(employee.toJSON().deactivateAt).toBeNull();
    });

    it('should throw when activating an already active employee', () => {
      const employee = Employee.create(makeValidProps());

      expect(() => employee.activate()).toThrow(EmployeeAlreadyActiveError);
    });
  });

  describe('mutations', () => {
    it('should change the password', () => {
      const employee = Employee.create(makeValidProps());
      const newPassword = Password.create('N3w!Passw0rd');

      employee.changePassword(newPassword);

      expect(employee.props.password.equals(newPassword)).toBe(true);
    });

    it('should change the role', () => {
      const employee = Employee.create(makeValidProps());

      employee.changeRole(EmployeeModel.Role.ADMIN);

      expect(employee.toJSON().role).toBe(EmployeeModel.Role.ADMIN);
    });

    it('should throw when changing to an invalid role', () => {
      const employee = Employee.create(makeValidProps());

      expect(() =>
        employee.changeRole('ROOT' as unknown as EmployeeModel.Role),
      ).toThrow(InvalidEmployeeRoleError);
    });

    it('should change name and email', () => {
      const employee = Employee.create(makeValidProps());

      employee.changeName(Name.create('New Name'));
      employee.changeEmail(Email.create('new@example.com'));

      expect(employee.toJSON().name).toBe('New Name');
      expect(employee.toJSON().email).toBe('new@example.com');
    });

    it('should change and clear the phone', () => {
      const employee = Employee.create(makeValidProps());

      employee.changePhone(Phone.create('+351 912 345 678'));
      expect(employee.toJSON().phone).toBe('351912345678');

      employee.changePhone(null);
      expect(employee.toJSON().phone).toBeNull();
    });

    it('should assign and clear the NIF', () => {
      const employee = Employee.create(makeValidProps());

      employee.assignNif(Nif.create('123456789'));
      expect(employee.toJSON().nif).toBe('123456789');

      employee.assignNif(null);
      expect(employee.toJSON().nif).toBeNull();
    });
  });

  describe('identity', () => {
    it('should consider two employees with the same id equal', () => {
      const a = Employee.reconstitute(makeSnapshot());
      const b = Employee.reconstitute(makeSnapshot());
      expect(a.equals(b)).toBe(true);
    });

    it('should consider employees with different ids not equal', () => {
      const a = Employee.create(makeValidProps());
      const b = Employee.create(makeValidProps());
      expect(a.equals(b)).toBe(false);
    });
  });
});
