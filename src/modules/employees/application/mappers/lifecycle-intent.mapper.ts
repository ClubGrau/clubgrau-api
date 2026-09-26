import { InvalidEmployeeStatusError } from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { LifecycleIntent } from '@modules/employees/domain/services/employee-lifecycle.policy';

export class LifecycleIntentMapper {
  static toIntent(status: EmployeeModel.OperationalStatus): LifecycleIntent {
    switch (status) {
      case EmployeeModel.Status.ACTIVE:
        return 'REACTIVATE';
      case EmployeeModel.Status.INACTIVE:
        return 'DEACTIVATE';
      case EmployeeModel.Status.VACATION:
        return 'VACATION';
      default: {
        const exhaustive: never = status;
        throw new InvalidEmployeeStatusError(`Invalid status: "${exhaustive}"`);
      }
    }
  }
}
