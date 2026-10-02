import { AuthenticationError } from '@modules/auth/domain/errors/auth.errors';
import { TokenPayload } from '@modules/auth/domain/models/token-payload.model';
import { FindAuthenticatableByIdPort } from '../ports/outbound/find-authenticatable-by-id.port';
import { TokenProviderPort } from '../ports/outbound/token-provider.port';
import { ReissueSessionTokenUseCase } from './reissue-session-token.usecase';

const loginCapableUser = {
  id: 'any_id',
  name: 'Ana Costa',
  email: 'ana.costa@example.com',
  passwordHash: 'hashed_password',
  status: 'ACTIVE',
  role: 'EMPLOYEE',
  loginCapable: true,
  sessionVersion: 3,
};

const makeStubs = () => ({
  findAuthenticatableByIdPortStub: {
    findAuthenticatableById: jest.fn().mockResolvedValue(loginCapableUser),
  } satisfies FindAuthenticatableByIdPort,
  tokenProviderPortStub: {
    generateToken: jest.fn().mockReturnValue({
      token: 'any_token',
    }),
  } satisfies TokenProviderPort<TokenPayload>,
});

const makeSut = (): SutTypes => {
  const { findAuthenticatableByIdPortStub, tokenProviderPortStub } =
    makeStubs();
  const sut = new ReissueSessionTokenUseCase(
    findAuthenticatableByIdPortStub,
    tokenProviderPortStub,
  );
  return {
    sut,
    findAuthenticatableByIdPortStub,
    tokenProviderPortStub,
  };
};

type SutTypes = {
  sut: ReissueSessionTokenUseCase;
  findAuthenticatableByIdPortStub: FindAuthenticatableByIdPort;
  tokenProviderPortStub: TokenProviderPort<TokenPayload>;
};

describe('ReissueSessionTokenUseCase', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(ReissueSessionTokenUseCase);
  });

  it('should not depend on password compare or credentials update', () => {
    expect(ReissueSessionTokenUseCase.length).toBe(2);
    const { sut } = makeSut();
    expect(Object.keys(sut)).toEqual([
      'findAuthenticatableByIdPort',
      'tokenProviderPort',
    ]);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
  ])(
    'should throw AuthenticationError when actorId is %s and not call finder or generateToken',
    async (_label, actorId) => {
      const { sut, findAuthenticatableByIdPortStub, tokenProviderPortStub } =
        makeSut();
      const findSpy = jest.spyOn(
        findAuthenticatableByIdPortStub,
        'findAuthenticatableById',
      );
      const generateTokenSpy = jest.spyOn(
        tokenProviderPortStub,
        'generateToken',
      );

      await expect(sut.execute({ actorId })).rejects.toThrow(
        AuthenticationError,
      );
      expect(findSpy).not.toHaveBeenCalled();
      expect(generateTokenSpy).not.toHaveBeenCalled();
    },
  );

  it('should throw AuthenticationError when finder returns null and not call generateToken', async () => {
    const { sut, findAuthenticatableByIdPortStub, tokenProviderPortStub } =
      makeSut();
    jest
      .spyOn(findAuthenticatableByIdPortStub, 'findAuthenticatableById')
      .mockResolvedValueOnce(null);
    const generateTokenSpy = jest.spyOn(tokenProviderPortStub, 'generateToken');

    await expect(sut.execute({ actorId: 'any_id' })).rejects.toThrow(
      AuthenticationError,
    );
    expect(generateTokenSpy).not.toHaveBeenCalled();
  });

  it('should throw AuthenticationError when user is not login capable and not call generateToken', async () => {
    const { sut, findAuthenticatableByIdPortStub, tokenProviderPortStub } =
      makeSut();
    jest
      .spyOn(findAuthenticatableByIdPortStub, 'findAuthenticatableById')
      .mockResolvedValueOnce({
        ...loginCapableUser,
        status: 'INACTIVE',
        loginCapable: false,
      });
    const generateTokenSpy = jest.spyOn(tokenProviderPortStub, 'generateToken');

    await expect(sut.execute({ actorId: 'any_id' })).rejects.toThrow(
      AuthenticationError,
    );
    expect(generateTokenSpy).not.toHaveBeenCalled();
  });

  it('should call generateToken with the loaded user claims', async () => {
    const { sut, tokenProviderPortStub } = makeSut();
    const generateTokenSpy = jest.spyOn(tokenProviderPortStub, 'generateToken');

    await sut.execute({ actorId: 'any_id' });

    expect(generateTokenSpy).toHaveBeenCalledWith({
      id: loginCapableUser.id,
      name: loginCapableUser.name,
      email: loginCapableUser.email,
      role: loginCapableUser.role,
      status: loginCapableUser.status,
      sessionVersion: loginCapableUser.sessionVersion,
    });
  });

  it('should return the token from the token provider', async () => {
    const { sut, tokenProviderPortStub } = makeSut();
    jest.spyOn(tokenProviderPortStub, 'generateToken').mockReturnValueOnce({
      token: 'reissued_token',
    });

    await expect(sut.execute({ actorId: 'any_id' })).resolves.toEqual({
      token: 'reissued_token',
    });
  });
});
