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
import { AllocateEmploymentIdPort } from '../ports/outbound/allocate-employment-id.port';
import { CreateEmployeeRepositoryPort } from '../ports/outbound/create-employee-repository.port';

export class CreateEmployeeUsecase implements CreateEmployeePort {
  constructor(
    private readonly employeePoliciesService: EmployeePoliciesService,
    private readonly encrypter: EncrypterPort,
    private readonly createEmployeeRepository: CreateEmployeeRepositoryPort,
    private readonly allocateEmploymentId: AllocateEmploymentIdPort,
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
      username: params.username,
      gender: params.gender,
      address: params.address,
      languages: params.languages,
      emergencyContact: params.emergencyContact,
      jobTitle: params.jobTitle,
    }).toJSON();

    await this.employeePoliciesService.ensureEmailIsAvailable(
      candidateEmployee.email,
    );

    const encryptedPassword = await this.encrypter.encrypt(password);
    const employmentId = await this.allocateEmploymentId.allocate();
    const employeeToCreate: EmployeeModel.toCreate = {
      ...candidateEmployee,
      password: encryptedPassword,
      employmentId,
    };

    const { id } = await this.createEmployeeRepository.create(employeeToCreate);
    return { id };
  }
}
