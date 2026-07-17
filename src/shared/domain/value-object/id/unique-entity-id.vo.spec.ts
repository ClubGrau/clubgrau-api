import {
  InvalidUniqueEntityIdError,
  UniqueEntityId,
} from './unique-entity-id.vo';

describe('UniqueEntityId (value object)', () => {
  const HEX_24 = /^[0-9a-f]{24}$/;

  it('should generate a 24-character hex string when no value is provided', () => {
    const id = new UniqueEntityId();
    expect(id.value).toMatch(HEX_24);
    expect(id.value).toHaveLength(24);
  });

  it('should generate unique ids', () => {
    const a = new UniqueEntityId();
    const b = new UniqueEntityId();
    expect(a.value).not.toBe(b.value);
  });

  it('should accept a valid provided id', () => {
    const value = '507f1f77bcf86cd799439011';
    expect(new UniqueEntityId(value).value).toBe(value);
  });

  it('should normalize an uppercase hex id to lowercase', () => {
    const id = new UniqueEntityId('507F1F77BCF86CD799439011');
    expect(id.value).toBe('507f1f77bcf86cd799439011');
  });

  it.each([
    '',
    'too-short',
    '507f1f77bcf86cd79943901', // 23 chars
    '507f1f77bcf86cd7994390111', // 25 chars
    'zzzzzzzzzzzzzzzzzzzzzzzz', // non-hex
  ])('should throw for invalid id %p', (invalid) => {
    expect(() => new UniqueEntityId(invalid)).toThrow(
      InvalidUniqueEntityIdError,
    );
  });

  it('should consider two ids with the same value equal', () => {
    const value = '507f1f77bcf86cd799439011';
    expect(new UniqueEntityId(value).equals(new UniqueEntityId(value))).toBe(
      true,
    );
  });
});
