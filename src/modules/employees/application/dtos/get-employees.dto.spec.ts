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
    expect(dto.status).toBeUndefined();
    expect(dto.role).toBeUndefined();
    expect(dto.search).toBeUndefined();
    expect(dto.page).toBeUndefined();
    expect(dto.limit).toBeUndefined();
  });

  it('should describe optional list filters and pagination', () => {
    const dto: GetEmployeesDto = {
      status: EmployeeModel.Status.ACTIVE,
      role: EmployeeModel.Role.MANAGER,
      search: 'grau',
      page: 2,
      limit: 10,
    };

    expect(dto.status).toBe(EmployeeModel.Status.ACTIVE);
    expect(dto.role).toBe(EmployeeModel.Role.MANAGER);
    expect(dto.search).toBe('grau');
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
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
      phone: '351912345678',
      nif: '123456789',
      status: EmployeeModel.Status.ACTIVE,
      createdAt,
      deactivateAt: null,
    };

    expect(item).toBeDefined();
    expect(item.id).toBe('valid_employee_id');
    expect(item.name).toBe('John Doe');
    expect(item.email).toBe('john@example.com');
    expect(item.role).toBe(EmployeeModel.Role.EMPLOYEE);
    expect(item.phone).toBe('351912345678');
    expect(item.nif).toBe('123456789');
    expect(item.status).toBe(EmployeeModel.Status.ACTIVE);
    expect(item.createdAt).toBe(createdAt);
    expect(item.deactivateAt).toBeNull();
    expect(item).not.toHaveProperty('password');
  });
});

describe('GetEmployeesResultDto', () => {
  it('should describe a paginated result carrying the employee list', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const result: GetEmployeesResultDto = {
      employees: [
        {
          id: 'valid_employee_id',
          name: 'John Doe',
          email: 'john@example.com',
          role: EmployeeModel.Role.EMPLOYEE,
          phone: null,
          nif: null,
          status: EmployeeModel.Status.ACTIVE,
          createdAt,
          deactivateAt: null,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    };

    expect(result.employees).toHaveLength(1);
    const [employee] = result.employees;
    expect(employee?.id).toBe('valid_employee_id');
    expect(employee).not.toHaveProperty('password');
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});
