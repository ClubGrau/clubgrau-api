import { InvalidNameError, Name } from './name.vo';

describe('Name (value object)', () => {
  it('should create a valid name', () => {
    const name = Name.create('John Doe');
    expect(name.value).toBe('John Doe');
    expect(name.toString()).toBe('John Doe');
  });

  it('should trim surrounding whitespace and collapse inner spaces', () => {
    const name = Name.create('  John    Doe  ');
    expect(name.value).toBe('John Doe');
  });

  it('should accept a name at the minimum length', () => {
    expect(Name.create('Al').value).toBe('Al');
  });

  it('should accept a name at the maximum length', () => {
    const maxName = 'a'.repeat(Name.MAX_LENGTH);
    expect(Name.create(maxName).value).toBe(maxName);
  });

  it.each([null, undefined])('should throw when value is %p', (value) => {
    expect(() => Name.create(value as unknown as string)).toThrow(
      InvalidNameError,
    );
  });

  it('should throw when name is too short', () => {
    expect(() => Name.create('A')).toThrow(InvalidNameError);
    expect(() => Name.create('   ')).toThrow(InvalidNameError);
  });

  it('should throw when name exceeds the maximum length', () => {
    expect(() => Name.create('a'.repeat(Name.MAX_LENGTH + 1))).toThrow(
      InvalidNameError,
    );
  });

  it('should consider two names with the same value equal', () => {
    expect(Name.create('John Doe').equals(Name.create('John Doe'))).toBe(true);
    expect(Name.create('John Doe').equals(Name.create('Jane Doe'))).toBe(false);
  });
});
