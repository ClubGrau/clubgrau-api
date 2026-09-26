import { Employee } from '../entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeProfessionalDataForbiddenError,
  LastAdminProtectedError,
} from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { CountLoginCapableAdminsPort } from '../ports/count-login-capable-admins.port';
import { CountNonRemovedAdminsPort } from '../ports/count-non-removed-admins.port';

export class EmployeeProfessionalDataPolicy {
  constructor(
    private readonly countPort: CountLoginCapableAdminsPort &
      CountNonRemovedAdminsPort,
  ) {}

  async assertCan(input: {
    actor: Employee;
    target: Employee;
    roleChange: boolean;
  }): Promise<void> {
    const { actor, target, roleChange } = input;

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
      throw new EmployeeProfessionalDataForbiddenError();
    }

    if (actor.role === EmployeeModel.Role.MANAGER) {
      if (
        target.role !== EmployeeModel.Role.EMPLOYEE ||
        actor.id === target.id
      ) {
        throw new EmployeeProfessionalDataForbiddenError();
      }
    }

    if (!roleChange) {
      return;
    }

    if (actor.role !== EmployeeModel.Role.ADMIN) {
      throw new EmployeeProfessionalDataForbiddenError();
    }

    if (target.role !== EmployeeModel.Role.ADMIN) {
      return;
    }

    const loginCapableCount = await this.countPort.countLoginCapableAdmins();
    if (loginCapableCount === 1) {
      throw new LastAdminProtectedError();
    }

    const nonRemovedCount = await this.countPort.countNonRemovedAdmins();
    if (nonRemovedCount === 1) {
      throw new LastAdminProtectedError();
    }
  }
}
