import { Employee } from '../entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeMainDataForbiddenError,
} from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';

export class EmployeeMainDataPolicy {
  assertCan(input: { actor: Employee; target: Employee }): void {
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
      throw new EmployeeMainDataForbiddenError();
    }

    if (actor.role === EmployeeModel.Role.MANAGER) {
      if (
        target.role !== EmployeeModel.Role.EMPLOYEE ||
        actor.id === target.id
      ) {
        throw new EmployeeMainDataForbiddenError();
      }
      return;
    }

    // ADMIN — any target including self
  }
}
