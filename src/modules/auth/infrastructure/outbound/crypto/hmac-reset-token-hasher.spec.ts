import { createHash } from 'crypto';
import { HmacResetTokenHasher } from './hmac-reset-token-hasher';

jest.mock('@configs/envs', () => ({
  __esModule: true,
  default: {
    passwordResetPepper: 'test-pepper',
  },
}));

const getEnvsMock = () =>
  jest.requireMock('@configs/envs').default as {
    passwordResetPepper: string | undefined;
  };

const makeSut = () => {
  const sut = new HmacResetTokenHasher();
  return { sut };
};

describe('HmacResetTokenHasher', () => {
  beforeEach(() => {
    getEnvsMock().passwordResetPepper = 'test-pepper';
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(HmacResetTokenHasher);
  });

  it('should return a 64-char hex digest', () => {
    const { sut } = makeSut();

    const digest = sut.hash('raw-token');

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should be deterministic for the same raw input', () => {
    const { sut } = makeSut();

    expect(sut.hash('raw-token')).toBe(sut.hash('raw-token'));
  });

  it('should produce different digests for different raw inputs', () => {
    const { sut } = makeSut();

    expect(sut.hash('raw-token-a')).not.toBe(sut.hash('raw-token-b'));
  });

  it('should throw when the pepper is not set', () => {
    getEnvsMock().passwordResetPepper = undefined;
    const { sut } = makeSut();

    expect(() => sut.hash('raw-token')).toThrow(
      'PASSWORD_RESET_PEPPER is not set in environment variables',
    );
  });

  it('should differ from a plain sha256 (pepper matters)', () => {
    const { sut } = makeSut();
    const plainSha256 = createHash('sha256').update('raw-token').digest('hex');

    expect(sut.hash('raw-token')).not.toBe(plainSha256);
  });
});
