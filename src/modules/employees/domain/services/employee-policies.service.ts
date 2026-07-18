import { FindEmployeeByEmailPort } from '../ports/find-employee-by-email.port';
import {
  EmployeeAlreadyExistsError,
  EmployeeInactiveError,
} from '../errors/employee.errors';

export class EmployeePoliciesService {
  constructor(private readonly findEmployeeByEmail: FindEmployeeByEmailPort) {}

  /**
   * Ensures an email is free to be used when creating a new employee.
   *
   * - not found        -> resolves (the email is available)
   * - found & active   -> throws EmployeeAlreadyExistsError
   * - found & inactive -> throws EmployeeInactiveError. Reactivating an
   *   inactive employee is a business decision not yet defined with the
   *   domain expert; blocking here keeps that scenario explicit instead of
   *   silently creating a duplicate.
   */
  async ensureEmailIsAvailable(email: string): Promise<void> {
    const existing = await this.findEmployeeByEmail.findByEmail(email);

    if (!existing) {
      return;
    }

    if (existing.isActive) {
      throw new EmployeeAlreadyExistsError();
    }

    throw new EmployeeInactiveError();
  }
}
