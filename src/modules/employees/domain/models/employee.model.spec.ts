import { Employee } from '../entities/Employee';
import { EmployeeModel } from './employee.model';

describe('EmployeeModel.Role', () => {
  it('should expose all roles', () => {
    expect(EmployeeModel.ROLES).toEqual(['ADMIN', 'MANAGER', 'EMPLOYEE']);
  });

  it('should identify valid roles', () => {
    expect(EmployeeModel.isRole('ADMIN')).toBe(true);
    expect(EmployeeModel.isRole(EmployeeModel.Role.MANAGER)).toBe(true);
  });

  it('should reject invalid roles', () => {
    expect(EmployeeModel.isRole('ROOT')).toBe(false);
    expect(EmployeeModel.isRole(123)).toBe(false);
    expect(EmployeeModel.isRole(null)).toBe(false);
  });
});

describe('EmployeeModel.Status', () => {
  it('should expose all statuses including REMOVED', () => {
    expect(EmployeeModel.STATUSES).toEqual([
      'ACTIVE',
      'INACTIVE',
      'VACATION',
      'REMOVED',
    ]);
  });

  it('should identify valid statuses', () => {
    expect(EmployeeModel.isStatus('ACTIVE')).toBe(true);
    expect(EmployeeModel.isStatus(EmployeeModel.Status.VACATION)).toBe(true);
    expect(EmployeeModel.isStatus('REMOVED')).toBe(true);
  });

  it('should reject invalid statuses', () => {
    expect(EmployeeModel.isStatus('active')).toBe(false);
    expect(EmployeeModel.isStatus(true)).toBe(false);
    expect(EmployeeModel.isStatus(null)).toBe(false);
  });
});

describe('EmployeeModel.isOperationalStatus', () => {
  it('should accept ACTIVE, INACTIVE, VACATION', () => {
    expect(EmployeeModel.isOperationalStatus('ACTIVE')).toBe(true);
    expect(EmployeeModel.isOperationalStatus('INACTIVE')).toBe(true);
    expect(EmployeeModel.isOperationalStatus('VACATION')).toBe(true);
  });

  it('should reject REMOVED', () => {
    expect(EmployeeModel.isOperationalStatus('REMOVED')).toBe(false);
  });

  it('should reject lowercase and non-string values', () => {
    expect(EmployeeModel.isOperationalStatus('active')).toBe(false);
    expect(EmployeeModel.isOperationalStatus(null)).toBe(false);
  });
});

describe('EmployeeModel.toCreate', () => {
  it('should match the serialized shape of an Employee', () => {
    const employee = Employee.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'P@ssword123',
      role: EmployeeModel.Role.EMPLOYEE,
    });

    const toCreate: EmployeeModel.toCreate = employee.toJSON();

    expect(toCreate.id).toEqual(expect.any(String));
    expect(toCreate.name).toBe('John Doe');
    expect(toCreate.email).toBe('john@example.com');
    expect(toCreate.role).toBe(EmployeeModel.Role.EMPLOYEE);
    expect(toCreate.password).toBe('[REDACTED]');
    expect(toCreate.phone).toBeNull();
    expect(toCreate.nif).toBeNull();
    expect(toCreate.username).toBeNull();
    expect(toCreate.gender).toBeNull();
    expect(toCreate.address).toBeNull();
    expect(toCreate.languages).toBeNull();
    expect(toCreate.emergencyContact).toBeNull();
    expect(toCreate.employmentId).toBeNull();
    expect(toCreate.jobTitle).toBeNull();
    expect(toCreate.status).toBe(EmployeeModel.Status.ACTIVE);
    expect(toCreate.deactivateAt).toBeNull();
    expect(toCreate.createdAt).toBeInstanceOf(Date);
  });
});
