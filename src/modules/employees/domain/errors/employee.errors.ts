import { DomainError } from '@shared/domain/errors/domain.error';

export class InvalidEmployeeRoleError extends DomainError {}

export class EmployeeAlreadyActiveError extends DomainError {
  constructor() {
    super('Employee is already active');
  }
}

export class EmployeeAlreadyInactiveError extends DomainError {
  constructor() {
    super('Employee is already inactive');
  }
}

export class PasswordNotMatchError extends DomainError {
  constructor() {
    super('Password and passwordConfirmation do not match');
  }
}
