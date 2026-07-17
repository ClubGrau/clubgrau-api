import { PasswordNotMatchError } from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

export class CreateEmployeeUsecase {
  async execute(params: EmployeeModel.CreateEmployeeDto): Promise<void> {
    const { password, passwordConfirmation } = params;

    if (password !== passwordConfirmation) {
      throw new PasswordNotMatchError();
    }
  }
}
