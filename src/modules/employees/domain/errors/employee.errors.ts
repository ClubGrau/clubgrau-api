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

export class EmployeeNotFoundError extends DomainError {
  constructor() {
    super('Employee not found');
  }
}

export class EmployeeAlreadyExistsError extends DomainError {
  constructor() {
    super('Employee already exists');
  }
}

export class EmployeeInactiveError extends DomainError {
  constructor() {
    super('Employee already exists but is inactive');
  }
}
