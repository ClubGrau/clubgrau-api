import { DomainError } from '@shared/domain/errors/domain.error';

/**
 * Generic authentication failure.
 * Use the same message for unknown email, wrong password, or inactive employee
 * so the API does not reveal which case occurred.
 */
export class AuthenticationError extends DomainError {
  constructor(message = 'Authentication failed') {
    super(message);
  }
}

export class PasswordResetedNotMatchError extends DomainError {
  constructor() {
    super('Password and passwordConfirmation do not match');
  }
}

export class InvalidOrExpiredTokenError extends DomainError {
  constructor() {
    super('Invalid or expired link');
  }
}
