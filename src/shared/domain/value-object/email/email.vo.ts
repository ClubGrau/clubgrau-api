import { ValueObject } from '../value-object';
import { DomainError } from '@shared/domain/errors/domain.error';

export class InvalidEmailError extends DomainError {}

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  static readonly MAX_LENGTH = 254;

  // Pragmatic RFC 5322 subset: local@domain.tld
  private static readonly EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  private constructor(props: EmailProps) {
    super(props);
  }

  static create(value: string): Email {
    if (value === null || value === undefined) {
      throw new InvalidEmailError('Email is required');
    }

    const normalized = value.trim().toLowerCase();

    if (normalized.length === 0) {
      throw new InvalidEmailError('Email is required');
    }

    if (normalized.length > Email.MAX_LENGTH) {
      throw new InvalidEmailError(
        `Email must be at most ${Email.MAX_LENGTH} characters long`,
      );
    }

    if (!Email.EMAIL_REGEX.test(normalized)) {
      throw new InvalidEmailError(`Invalid email format: "${value}"`);
    }

    return new Email({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }

  get domain(): string {
    return this.props.value.split('@')[1] as string;
  }

  toJSON(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
