import { DomainError } from '@shared/domain/errors/domain.error';

export class IndicationCategoryUnknownError extends DomainError {
  constructor() {
    super('Indication category is unknown');
  }
}

export class IndicationCategoryDoesNotHoldOriginsError extends DomainError {
  constructor() {
    super('Indication category does not hold origins');
  }
}

export class IndicationOriginNotFoundError extends DomainError {
  constructor() {
    super('Indication origin not found');
  }
}

export class IndicationOriginNameTakenError extends DomainError {
  constructor() {
    super('Indication origin name is already reserved');
  }
}
