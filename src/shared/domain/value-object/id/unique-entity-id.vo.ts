import { randomBytes } from 'node:crypto';
import { ValueObject } from '../value-object';
import { DomainError } from '@shared/domain/errors/domain.error';

export class InvalidUniqueEntityIdError extends DomainError {}

interface UniqueEntityIdProps {
  value: string;
}

/**
 * Identity value object.
 *
 * Generates (or validates) a 24-character lowercase hexadecimal string,
 * produced from 12 cryptographically random bytes.
 */
export class UniqueEntityId extends ValueObject<UniqueEntityIdProps> {
  private static readonly HEX_24 = /^[0-9a-f]{24}$/;

  constructor(value?: string) {
    super({ value: UniqueEntityId.resolve(value) });
  }

  private static resolve(value?: string): string {
    const resolved = (value ?? UniqueEntityId.generate()).toLowerCase();

    if (!UniqueEntityId.HEX_24.test(resolved)) {
      throw new InvalidUniqueEntityIdError(
        `Invalid id: "${value}". Expected a 24-character hex string.`,
      );
    }

    return resolved;
  }

  private static generate(): string {
    return randomBytes(12).toString('hex');
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
