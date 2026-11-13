import { DomainError } from '@shared/domain/errors/domain.error';

export class CustomerAlreadyExistsError extends DomainError {
  constructor() {
    super('Customer already exists');
  }
}

export class CustomerIndicationInvalidError extends DomainError {
  constructor() {
    super('Customer indication is invalid');
  }
}

export class CustomerIndicationOriginNotFoundError extends DomainError {
  constructor() {
    super('Customer indication origin was not found');
  }
}

export class CustomerIndicationOriginCategoryMismatchError extends DomainError {
  constructor() {
    super('Customer indication origin belongs to another category');
  }
}

export class CustomerIndicationOriginEndedError extends DomainError {
  constructor() {
    super('Customer indication origin is ended');
  }
}

export class CustomerReferrerNotFoundError extends DomainError {
  constructor() {
    super('Referrer customer was not found');
  }
}

export class CustomerNotFoundError extends DomainError {
  constructor() {
    super('Customer was not found');
  }
}

export class CustomerAlreadyRemovedError extends DomainError {
  constructor() {
    super('Customer is already removed');
  }
}

export class CustomerActorAuthenticationFailedError extends DomainError {
  constructor() {
    super('Authentication failed');
  }
}
