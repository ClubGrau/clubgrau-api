import { Employee } from '@modules/employees/domain/entities/Employee';
import { PasswordNotMatchError } from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeePoliciesService } from '@modules/employees/domain/services/employee-policies.service';
import { EncrypterPort } from '../ports/outbound/encrypter.port';

export class CreateEmployeeUsecase {
  constructor(
    private readonly employeePoliciesService: EmployeePoliciesService,
    private readonly encrypter: EncrypterPort,
  ) {}

  async execute(params: EmployeeModel.CreateEmployeeDto): Promise<void> {
    const { password, passwordConfirmation } = params;

    if (password !== passwordConfirmation) {
      throw new PasswordNotMatchError();
    }

    const candidateEmployee = Employee.create({
      name: params.name,
      email: params.email,
      role: params.role,
      nif: params.nif,
      password: params.password,
    }).toJSON();

    await this.employeePoliciesService.ensureEmailIsAvailable(
      candidateEmployee.email,
    );

    await this.encrypter.encrypt(password);
  }
}
