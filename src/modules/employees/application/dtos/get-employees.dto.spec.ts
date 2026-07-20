import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import {
  GetEmployeesDto,
  GetEmployeesItemDto,
  GetEmployeesResultDto,
} from './get-employees.dto';

describe('GetEmployeesDto', () => {
  it('should allow an empty filter object', () => {
    const dto: GetEmployeesDto = {};

    expect(dto).toBeDefined();
    expect(dto.isActive).toBeUndefined();
    expect(dto.role).toBeUndefined();
  });

  it('should describe optional list filters', () => {
    const dto: GetEmployeesDto = {
      isActive: true,
      role: EmployeeModel.Role.MANAGER,
    };

    expect(dto.isActive).toBe(true);
    expect(dto.role).toBe(EmployeeModel.Role.MANAGER);
  });
});

describe('GetEmployeesItemDto', () => {
  it('should describe a read model without password', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const item: GetEmployeesItemDto = {
      id: 'valid_employee_id',
      name: 'John Doe',
      email: 'john@example.com',
      role: EmployeeModel.Role.EMPLOYEE,
      nif: '123456789',
      isActive: true,
      createdAt,
      deactivateAt: null,
    };

    expect(item).toBeDefined();
    expect(item.id).toBe('valid_employee_id');
    expect(item.name).toBe('John Doe');
    expect(item.email).toBe('john@example.com');
    expect(item.role).toBe(EmployeeModel.Role.EMPLOYEE);
    expect(item.nif).toBe('123456789');
    expect(item.isActive).toBe(true);
    expect(item.createdAt).toBe(createdAt);
    expect(item.deactivateAt).toBeNull();
    expect(item).not.toHaveProperty('password');
  });
});

describe('GetEmployeesResultDto', () => {
  it('should describe a result carrying the employee list', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const result: GetEmployeesResultDto = {
      employees: [
        {
          id: 'valid_employee_id',
          name: 'John Doe',
          email: 'john@example.com',
          role: EmployeeModel.Role.EMPLOYEE,
          nif: null,
          isActive: true,
          createdAt,
          deactivateAt: null,
        },
      ],
    };

    expect(result.employees).toHaveLength(1);
    const [employee] = result.employees;
    expect(employee?.id).toBe('valid_employee_id');
    expect(employee).not.toHaveProperty('password');
  });
});
