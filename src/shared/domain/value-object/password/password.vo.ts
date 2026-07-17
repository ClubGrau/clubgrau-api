import { ValueObject } from '../value-object';
import { DomainError } from '@shared/domain/errors/domain.error';

export class InvalidPasswordError extends DomainError {}

interface PasswordProps {
  value: string;
  hashed: boolean;
}

/**
 * Password value object.
 *
 * `create` enforces the domain password policy on a raw (plaintext) password.
 * Hashing itself is an infrastructure concern: a driven adapter (port) is
 * responsible for hashing the raw value before persistence. Use `fromHash`
 * to reconstitute a Password from an already-hashed value (e.g. loaded from
 * the repository), which bypasses the strength policy.
 */
export class Password extends ValueObject<PasswordProps> {
  static readonly MIN_LENGTH = 8;
  static readonly MAX_LENGTH = 128;

  private constructor(props: PasswordProps) {
    super(props);
  }

  static create(value: string): Password {
    if (value === null || value === undefined) {
      throw new InvalidPasswordError('Password is required');
    }

    if (value.length < Password.MIN_LENGTH) {
      throw new InvalidPasswordError(
        `Password must be at least ${Password.MIN_LENGTH} characters long`,
      );
    }

    if (value.length > Password.MAX_LENGTH) {
      throw new InvalidPasswordError(
        `Password must be at most ${Password.MAX_LENGTH} characters long`,
      );
    }

    if (!/[a-z]/.test(value)) {
      throw new InvalidPasswordError(
        'Password must contain at least one lowercase letter',
      );
    }

    if (!/[A-Z]/.test(value)) {
      throw new InvalidPasswordError(
        'Password must contain at least one uppercase letter',
      );
    }

    if (!/[0-9]/.test(value)) {
      throw new InvalidPasswordError(
        'Password must contain at least one digit',
      );
    }

    if (!/[^a-zA-Z0-9]/.test(value)) {
      throw new InvalidPasswordError(
        'Password must contain at least one special character',
      );
    }

    return new Password({ value, hashed: false });
  }

  static fromHash(hash: string): Password {
    if (!hash || hash.trim().length === 0) {
      throw new InvalidPasswordError('Password hash is required');
    }
    return new Password({ value: hash, hashed: true });
  }

  get value(): string {
    return this.props.value;
  }

  get isHashed(): boolean {
    return this.props.hashed;
  }

  override toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }
}
