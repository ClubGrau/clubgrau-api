import { ActorAuthenticationFailedError } from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';

export class EmployeeOwnDataPolicy {
  assertCan(status: EmployeeModel.Status): void {
    if (
      status === EmployeeModel.Status.ACTIVE ||
      status === EmployeeModel.Status.VACATION
    ) {
      return;
    }

    throw new ActorAuthenticationFailedError();
  }
}
