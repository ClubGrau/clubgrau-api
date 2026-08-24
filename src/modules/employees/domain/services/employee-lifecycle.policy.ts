import { Employee } from '../entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotInactiveError,
  LastAdminProtectedError,
} from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { CountActiveAdminsPort } from '../ports/count-active-admins.port';
import { CountNonRemovedAdminsPort } from '../ports/count-non-removed-admins.port';

export type LifecycleIntent =
  'DEACTIVATE' | 'REACTIVATE' | 'VACATION' | 'REMOVE';

export class EmployeeLifecyclePolicy {
  constructor(
    private readonly countPort: CountNonRemovedAdminsPort &
      CountActiveAdminsPort,
  ) {}

  async assertCan(input: {
    actor: Employee;
    target: Employee;
    intent: LifecycleIntent;
  }): Promise<void> {
    const { actor, target, intent } = input;

    // Rule 1: Actor must be ACTIVE
    if (actor.status !== EmployeeModel.Status.ACTIVE) {
      throw new ActorAuthenticationFailedError();
    }

    // Rule 2: Self-Remove is forbidden
    if (actor.id === target.id && intent === 'REMOVE') {
      throw new EmployeeLifecycleForbiddenError();
    }

    // Rule 3: Target already removed
    if (target.status === EmployeeModel.Status.REMOVED) {
      throw new EmployeeAlreadyRemovedError();
    }

    // Rule 4: Role matrix
    if (actor.role === EmployeeModel.Role.EMPLOYEE) {
      throw new EmployeeLifecycleForbiddenError();
    }

    if (actor.role === EmployeeModel.Role.MANAGER) {
      if (intent === 'REMOVE' || target.role !== EmployeeModel.Role.EMPLOYEE) {
        throw new EmployeeLifecycleForbiddenError();
      }
      // MANAGER acting on EMPLOYEE with DEACTIVATE/REACTIVATE/VACATION — allowed
      return;
    }

    // Actor is ADMIN — proceed to rules 5 and 6

    // Rule 5: Last Admin protection
    if (target.role === EmployeeModel.Role.ADMIN) {
      if (
        (intent === 'DEACTIVATE' || intent === 'VACATION') &&
        target.status === EmployeeModel.Status.ACTIVE
      ) {
        const activeCount = await this.countPort.countActiveAdmins();
        if (activeCount === 1) {
          throw new LastAdminProtectedError();
        }
      }

      if (intent === 'REMOVE') {
        const nonRemovedCount = await this.countPort.countNonRemovedAdmins();
        if (nonRemovedCount === 1) {
          throw new LastAdminProtectedError();
        }
      }
    }

    // Rule 6: REMOVE requires target to be INACTIVE
    if (
      intent === 'REMOVE' &&
      target.status !== EmployeeModel.Status.INACTIVE
    ) {
      throw new EmployeeNotInactiveError();
    }
  }
}
