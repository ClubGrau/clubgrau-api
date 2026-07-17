import { InvalidNifError, Nif } from './nif.vo';

describe('Nif (value object)', () => {
  // 123456789 and 200000004 are valid Portuguese NIFs (mod-11 check digit).
  const VALID_NIF = '123456789';

  it('should create a valid NIF', () => {
    expect(Nif.create(VALID_NIF).value).toBe(VALID_NIF);
    expect(Nif.create('200000004').value).toBe('200000004');
  });

  it('should strip whitespace before validating', () => {
    expect(Nif.create(' 123 456 789 ').value).toBe(VALID_NIF);
  });

  it.each([null, undefined])('should throw when value is %p', (value) => {
    expect(() => Nif.create(value as unknown as string)).toThrow(
      InvalidNifError,
    );
  });

  it.each(['12345678', '1234567890', '12345678a', ''])(
    'should throw when NIF is not 9 digits (%p)',
    (invalid) => {
      expect(() => Nif.create(invalid)).toThrow(InvalidNifError);
    },
  );

  it('should throw for an invalid leading digit', () => {
    expect(() => Nif.create('423456789')).toThrow(InvalidNifError);
  });

  it('should throw for an invalid check digit', () => {
    expect(() => Nif.create('123456788')).toThrow(InvalidNifError);
  });

  it('should consider two NIFs with the same value equal', () => {
    expect(Nif.create(VALID_NIF).equals(Nif.create(VALID_NIF))).toBe(true);
    expect(Nif.create(VALID_NIF).equals(Nif.create('200000004'))).toBe(false);
  });
});
