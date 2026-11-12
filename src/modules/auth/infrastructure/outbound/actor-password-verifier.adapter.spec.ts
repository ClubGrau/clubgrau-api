import { FindAuthenticatableByIdPort } from '@modules/auth/application/ports/outbound/find-authenticatable-by-id.port';
import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { ActorPasswordVerifierAdapter } from './actor-password-verifier.adapter';

const makeAuthenticatableUser = (
  overrides: Partial<AuthenticatableUser> = {},
): AuthenticatableUser => ({
  id: 'actor-id',
  name: 'Any Name',
  email: 'any@mail.com',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  sessionVersion: 0,
  loginCapable: true,
  passwordHash: 'hash',
  ...overrides,
});

const makeSut = () => {
  const findAuthenticatableById: FindAuthenticatableByIdPort = {
    findAuthenticatableById: jest
      .fn()
      .mockResolvedValue(makeAuthenticatableUser()),
  };
  const compareHash: CompareHashPort = {
    compare: jest.fn().mockResolvedValue(true),
  };
  const sut = new ActorPasswordVerifierAdapter(
    findAuthenticatableById,
    compareHash,
  );

  return { sut, findAuthenticatableById, compareHash };
};

describe('ActorPasswordVerifierAdapter', () => {
  it('should be defined', () => {
    const { sut } = makeSut();

    expect(sut).toBeInstanceOf(ActorPasswordVerifierAdapter);
    expect(ActorPasswordVerifierAdapter.length).toBe(2);
  });

  it('should return true when password matches', async () => {
    const { sut, findAuthenticatableById, compareHash } = makeSut();

    const result = await sut.verify('actor-id', 'secret');

    expect(
      findAuthenticatableById.findAuthenticatableById,
    ).toHaveBeenCalledWith('actor-id');
    expect(compareHash.compare).toHaveBeenCalledWith('secret', 'hash');
    expect(result).toBe(true);
  });

  it('should return false when compare resolves false', async () => {
    const { sut, compareHash } = makeSut();
    jest.mocked(compareHash.compare).mockResolvedValueOnce(false);

    const result = await sut.verify('actor-id', 'wrong');

    expect(result).toBe(false);
  });

  it('should return false when compare rejects', async () => {
    const { sut, compareHash } = makeSut();
    jest.mocked(compareHash.compare).mockRejectedValueOnce(new Error('bcrypt'));

    const result = await sut.verify('actor-id', 'secret');

    expect(result).toBe(false);
  });

  it('should return false when user is null without calling compare', async () => {
    const { sut, findAuthenticatableById, compareHash } = makeSut();
    jest
      .mocked(findAuthenticatableById.findAuthenticatableById)
      .mockResolvedValueOnce(null);

    const result = await sut.verify('actor-id', 'secret');

    expect(result).toBe(false);
    expect(compareHash.compare).not.toHaveBeenCalled();
  });

  it('should return false when user is not login capable without calling compare', async () => {
    const { sut, findAuthenticatableById, compareHash } = makeSut();
    jest
      .mocked(findAuthenticatableById.findAuthenticatableById)
      .mockResolvedValueOnce(makeAuthenticatableUser({ loginCapable: false }));

    const result = await sut.verify('actor-id', 'secret');

    expect(result).toBe(false);
    expect(compareHash.compare).not.toHaveBeenCalled();
  });

  it('should return false when user has no password hash without calling compare', async () => {
    const { sut, findAuthenticatableById, compareHash } = makeSut();
    jest
      .mocked(findAuthenticatableById.findAuthenticatableById)
      .mockResolvedValueOnce(
        makeAuthenticatableUser({ passwordHash: undefined }),
      );

    const result = await sut.verify('actor-id', 'secret');

    expect(result).toBe(false);
    expect(compareHash.compare).not.toHaveBeenCalled();
  });

  it('should return false for empty actorId without calling stubs', async () => {
    const { sut, findAuthenticatableById, compareHash } = makeSut();

    const result = await sut.verify('', 'secret');

    expect(result).toBe(false);
    expect(
      findAuthenticatableById.findAuthenticatableById,
    ).not.toHaveBeenCalled();
    expect(compareHash.compare).not.toHaveBeenCalled();
  });

  it('should return false for empty password without calling stubs', async () => {
    const { sut, findAuthenticatableById, compareHash } = makeSut();

    const result = await sut.verify('actor-id', '');

    expect(result).toBe(false);
    expect(
      findAuthenticatableById.findAuthenticatableById,
    ).not.toHaveBeenCalled();
    expect(compareHash.compare).not.toHaveBeenCalled();
  });

  it('should propagate when findAuthenticatableById rejects', async () => {
    const { sut, findAuthenticatableById, compareHash } = makeSut();
    const error = new Error('database down');
    jest
      .mocked(findAuthenticatableById.findAuthenticatableById)
      .mockRejectedValueOnce(error);

    await expect(sut.verify('actor-id', 'secret')).rejects.toBe(error);
    expect(compareHash.compare).not.toHaveBeenCalled();
  });
});
