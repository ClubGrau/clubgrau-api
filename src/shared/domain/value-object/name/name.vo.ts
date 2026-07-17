import { ValueObject } from '../value-object';
import { DomainError } from '@shared/domain/errors/domain.error';

export class InvalidNameError extends DomainError {}

interface NameProps {
  value: string;
}

export class Name extends ValueObject<NameProps> {
  static readonly MIN_LENGTH = 2;
  static readonly MAX_LENGTH = 100;

  private constructor(props: NameProps) {
    super(props);
  }

  static create(value: string): Name {
    if (value === null || value === undefined) {
      throw new InvalidNameError('Name is required');
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    if (normalized.length < Name.MIN_LENGTH) {
      throw new InvalidNameError(
        `Name must be at least ${Name.MIN_LENGTH} characters long`,
      );
    }

    if (normalized.length > Name.MAX_LENGTH) {
      throw new InvalidNameError(
        `Name must be at most ${Name.MAX_LENGTH} characters long`,
      );
    }

    return new Name({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }

  toJSON(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
