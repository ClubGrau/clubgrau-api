import { Employee } from '../entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeePersonalDataForbiddenError,
} from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';

export type EmployeePersonalDataPolicyInput = {
  actor: Employee;
  target: Employee;
};

export class EmployeePersonalDataPolicy {
  assertCan(input: EmployeePersonalDataPolicyInput): void {
    const { actor, target } = input;

    if (
      actor.status !== EmployeeModel.Status.ACTIVE &&
      actor.status !== EmployeeModel.Status.VACATION
    ) {
      throw new ActorAuthenticationFailedError();
    }

    if (target.status === EmployeeModel.Status.REMOVED) {
      throw new EmployeeAlreadyRemovedError();
    }

    if (actor.role === EmployeeModel.Role.EMPLOYEE) {
      throw new EmployeePersonalDataForbiddenError();
    }

    if (actor.role === EmployeeModel.Role.MANAGER) {
      if (
        target.role !== EmployeeModel.Role.EMPLOYEE ||
        actor.id === target.id
      ) {
        throw new EmployeePersonalDataForbiddenError();
      }
      return;
    }

    // ADMIN — any target including self
  }
}
