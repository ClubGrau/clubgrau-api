import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import {
  CreateEmployeeDto,
  CreateEmployeeResultDto,
} from './create-employee.dto';

describe('CreateEmployeeDto', () => {
  it('should describe the create-employee use case input', () => {
    const dto: CreateEmployeeDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: '123456',
      role: EmployeeModel.Role.EMPLOYEE,
      passwordConfirmation: '123456',
    };

    expect(dto).toBeDefined();
    expect(dto.name).toBe('John Doe');
    expect(dto.email).toBe('john@example.com');
    expect(dto.password).toBe('123456');
    expect(dto.role).toBe(EmployeeModel.Role.EMPLOYEE);
    expect(dto.passwordConfirmation).toBe('123456');
  });
  it('should accept optional phone and nif', () => {
    const dto: CreateEmployeeDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: '123456',
      role: EmployeeModel.Role.EMPLOYEE,
      passwordConfirmation: '123456',
      phone: '+351 912 345 678',
      nif: 123456789,
    };

    expect(dto.phone).toBe('+351 912 345 678');
    expect(dto.nif).toBe(123456789);
  });

  it('should accept optional profile fields', () => {
    const dto: CreateEmployeeDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: '123456',
      role: EmployeeModel.Role.EMPLOYEE,
      passwordConfirmation: '123456',
      username: 'jdoe',
      gender: 'male',
      address: 'Rua do Grau, 10',
      languages: 'pt,en',
      emergencyContact: '+351 910 000 000',
      employmentId: 'HR-001',
      jobTitle: 'Barber',
    };

    expect(dto.username).toBe('jdoe');
    expect(dto.gender).toBe('male');
    expect(dto.address).toBe('Rua do Grau, 10');
    expect(dto.languages).toBe('pt,en');
    expect(dto.emergencyContact).toBe('+351 910 000 000');
    expect(dto.employmentId).toBe('HR-001');
    expect(dto.jobTitle).toBe('Barber');
  });
});

describe('CreateEmployeeResultDto', () => {
  it('should describe a result carrying the created employee id', () => {
    const result: CreateEmployeeResultDto = {
      id: 'valid_employee_id',
    };

    expect(result).toBeDefined();
    expect(result.id).toBe('valid_employee_id');
  });
});
