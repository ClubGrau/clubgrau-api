import { ReissueSessionTokenPort } from '@modules/auth/application/ports/inbound/reissue-session-token.port';
import { AuthenticationError } from '@modules/auth/domain/errors/auth.errors';
import { ReissueOwnSessionTokenAdapter } from './reissue-own-session-token.adapter';

class MappedAuthenticationFailedError extends Error {
  constructor() {
    super('Authentication failed');
    this.name = 'MappedAuthenticationFailedError';
  }
}

const makeSut = () => {
  const reissueSessionToken: ReissueSessionTokenPort = {
    execute: jest.fn().mockResolvedValue({ token: 'signed_token' }),
  };
  const authenticationFailedError = jest
    .fn()
    .mockImplementation(() => new MappedAuthenticationFailedError());
  const sut = new ReissueOwnSessionTokenAdapter(
    reissueSessionToken,
    authenticationFailedError,
  );

  return { sut, reissueSessionToken, authenticationFailedError };
};

describe('ReissueOwnSessionTokenAdapter', () => {
  it('should be defined', () => {
    const { sut } = makeSut();

    expect(sut).toBeInstanceOf(ReissueOwnSessionTokenAdapter);
    expect(ReissueOwnSessionTokenAdapter.length).toBe(2);
  });

  it('should return the token from the auth command', async () => {
    const { sut, reissueSessionToken } = makeSut();

    const result = await sut.execute('actor-id');

    expect(reissueSessionToken.execute).toHaveBeenCalledWith({
      actorId: 'actor-id',
    });
    expect(result).toEqual({ token: 'signed_token' });
  });

  it('should map AuthenticationError to the injected employees failure', async () => {
    const { sut, reissueSessionToken, authenticationFailedError } = makeSut();
    jest
      .mocked(reissueSessionToken.execute)
      .mockRejectedValueOnce(new AuthenticationError());

    await expect(sut.execute('actor-id')).rejects.toBeInstanceOf(
      MappedAuthenticationFailedError,
    );
    expect(authenticationFailedError).toHaveBeenCalledTimes(1);
  });

  it('should propagate unexpected errors', async () => {
    const { sut, reissueSessionToken, authenticationFailedError } = makeSut();
    const unexpected = new Error('token provider down');
    jest.mocked(reissueSessionToken.execute).mockRejectedValueOnce(unexpected);

    await expect(sut.execute('actor-id')).rejects.toBe(unexpected);
    expect(authenticationFailedError).not.toHaveBeenCalled();
  });
});
