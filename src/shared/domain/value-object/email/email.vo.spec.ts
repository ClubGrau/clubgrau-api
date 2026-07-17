import { Email, InvalidEmailError } from './email.vo';

describe('Email (value object)', () => {
  it('should create a valid email', () => {
    const email = Email.create('john.doe@example.com');
    expect(email.value).toBe('john.doe@example.com');
  });

  it('should normalize to lowercase and trim', () => {
    const email = Email.create('  John.Doe@Example.COM  ');
    expect(email.value).toBe('john.doe@example.com');
  });

  it('should expose the domain part', () => {
    expect(Email.create('john@grau.pt').domain).toBe('grau.pt');
  });

  it.each([
    'plainaddress',
    '@no-local.com',
    'no-domain@',
    'no-tld@example',
    'spaces in@example.com',
    'double@@example.com',
  ])('should throw for invalid email %p', (invalid) => {
    expect(() => Email.create(invalid)).toThrow(InvalidEmailError);
  });

  it.each([null, undefined, ''])('should throw when value is %p', (value) => {
    expect(() => Email.create(value as unknown as string)).toThrow(
      InvalidEmailError,
    );
  });

  it('should throw when email exceeds the maximum length', () => {
    const longEmail = `${'a'.repeat(Email.MAX_LENGTH)}@example.com`;
    expect(() => Email.create(longEmail)).toThrow(InvalidEmailError);
  });

  it('should consider two emails with the same normalized value equal', () => {
    expect(
      Email.create('john@example.com').equals(Email.create('JOHN@example.com')),
    ).toBe(true);
  });
});
