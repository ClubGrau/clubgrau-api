import { DomainError } from '@shared/domain/errors/domain.error';

export class InvalidEmployeeRoleError extends DomainError {}

export class InvalidEmployeeStatusError extends DomainError {}

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

export class EmployeeAlreadyOnVacationError extends DomainError {
  constructor() {
    super('Employee is already on vacation');
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
    super('Employee already exists but is not active');
  }
}

export class ActorAuthenticationFailedError extends DomainError {
  constructor() {
    super('Authentication failed');
  }
}

export class EmployeeLifecycleForbiddenError extends DomainError {
  constructor() {
    super('Action not allowed');
  }
}

export class LastAdminProtectedError extends DomainError {
  constructor() {
    super('Last Admin must stay ACTIVE until another Admin exists');
  }
}

export class EmployeeNotInactiveError extends DomainError {
  constructor() {
    super('Employee is not inactive');
  }
}

export class EmployeeAlreadyRemovedError extends DomainError {
  constructor() {
    super('Employee is already removed');
  }
}
