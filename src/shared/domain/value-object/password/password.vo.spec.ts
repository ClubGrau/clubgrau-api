import { InvalidPasswordError, Password } from './password.vo';

describe('Password (value object)', () => {
  const VALID = 'Str0ng!Pass';

  it('should create a valid password that satisfies the policy', () => {
    const password = Password.create(VALID);
    expect(password.value).toBe(VALID);
    expect(password.isHashed).toBe(false);
  });

  it.each([null, undefined])('should throw when value is %p', (value) => {
    expect(() => Password.create(value as unknown as string)).toThrow(
      InvalidPasswordError,
    );
  });

  it('should throw when password is too short', () => {
    expect(() => Password.create('Aa1!aa')).toThrow(InvalidPasswordError);
  });

  it('should throw when password exceeds the maximum length', () => {
    const long = `Aa1!${'a'.repeat(Password.MAX_LENGTH)}`;
    expect(() => Password.create(long)).toThrow(InvalidPasswordError);
  });

  it('should throw when missing a lowercase letter', () => {
    expect(() => Password.create('STR0NG!PASS')).toThrow(InvalidPasswordError);
  });

  it('should throw when missing an uppercase letter', () => {
    expect(() => Password.create('str0ng!pass')).toThrow(InvalidPasswordError);
  });

  it('should throw when missing a digit', () => {
    expect(() => Password.create('Strong!Pass')).toThrow(InvalidPasswordError);
  });

  it('should throw when missing a special character', () => {
    expect(() => Password.create('Str0ngPass1')).toThrow(InvalidPasswordError);
  });

  describe('fromHash', () => {
    it('should reconstitute a password from a hash without policy checks', () => {
      const password = Password.fromHash('$2b$10$abcdefghijklmnopqrstuv');
      expect(password.isHashed).toBe(true);
      expect(password.value).toBe('$2b$10$abcdefghijklmnopqrstuv');
    });

    it('should throw when the hash is empty', () => {
      expect(() => Password.fromHash('')).toThrow(InvalidPasswordError);
      expect(() => Password.fromHash('   ')).toThrow(InvalidPasswordError);
    });
  });

  it('should never leak the raw value through toString/toJSON', () => {
    const password = Password.create(VALID);
    expect(password.toString()).toBe('[REDACTED]');
    expect(JSON.stringify({ password })).toBe('{"password":"[REDACTED]"}');
  });
});
