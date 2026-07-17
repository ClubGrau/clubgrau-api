import { ValueObject } from '../value-object';
import { DomainError } from '@shared/domain/errors/domain.error';

export class InvalidNifError extends DomainError {}

interface NifProps {
  value: string;
}

/**
 * NIF (Número de Identificação Fiscal - Portugal).
 * Validates: 9 digits + valid leading digit + mod-11 check digit.
 */
export class Nif extends ValueObject<NifProps> {
  // Valid leading digits for individuals/companies (single-digit prefixes).
  private static readonly VALID_FIRST_DIGITS = [
    '1',
    '2',
    '3',
    '5',
    '6',
    '8',
    '9',
  ];

  private constructor(props: NifProps) {
    super(props);
  }

  static create(value: string): Nif {
    if (value === null || value === undefined) {
      throw new InvalidNifError('NIF is required');
    }

    const normalized = value.replace(/\s/g, '');

    if (!/^\d{9}$/.test(normalized)) {
      throw new InvalidNifError('NIF must have exactly 9 digits');
    }

    if (!Nif.VALID_FIRST_DIGITS.includes(normalized.charAt(0))) {
      throw new InvalidNifError(`Invalid NIF leading digit: "${value}"`);
    }

    if (!Nif.hasValidCheckDigit(normalized)) {
      throw new InvalidNifError(`Invalid NIF check digit: "${value}"`);
    }

    return new Nif({ value: normalized });
  }

  private static hasValidCheckDigit(nif: string): boolean {
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += Number(nif.charAt(i)) * (9 - i);
    }
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? 0 : 11 - remainder;
    return checkDigit === Number(nif.charAt(8));
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
