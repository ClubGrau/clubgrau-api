import { Employee } from '@modules/employees/domain/entities/Employee';
import { PasswordNotMatchError } from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeePoliciesService } from '@modules/employees/domain/services/employee-policies.service';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import {
  CreateEmployeeDto,
  CreateEmployeeResultDto,
} from '../dtos/create-employee.dto';
import { CreateEmployeePort } from '../ports/inbound/create-employee.port';
import { CreateEmployeeRepositoryPort } from '../ports/outbound/create-employee-repository.port';

export class CreateEmployeeUsecase implements CreateEmployeePort {
  constructor(
    private readonly employeePoliciesService: EmployeePoliciesService,
    private readonly encrypter: EncrypterPort,
    private readonly createEmployeeRepository: CreateEmployeeRepositoryPort,
  ) {}

  async execute(params: CreateEmployeeDto): Promise<CreateEmployeeResultDto> {
    const { password, passwordConfirmation } = params;

    if (password !== passwordConfirmation) {
      throw new PasswordNotMatchError();
    }

    const candidateEmployee = Employee.create({
      name: params.name,
      email: params.email,
      role: params.role,
      phone: params.phone,
      nif: params.nif,
      password: params.password,
    }).toJSON();

    await this.employeePoliciesService.ensureEmailIsAvailable(
      candidateEmployee.email,
    );

    const encryptedPassword = await this.encrypter.encrypt(password);
    const employeeToCreate: EmployeeModel.toCreate = {
      ...candidateEmployee,
      password: encryptedPassword,
    };

    const { id } = await this.createEmployeeRepository.create(employeeToCreate);
    return { id };
  }
}
