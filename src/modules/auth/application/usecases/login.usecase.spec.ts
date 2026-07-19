import { AuthenticationError } from '@modules/auth/domain/errors/auth.errors';
import { FindAuthenticatableByEmailPort } from '../ports/outbound/find-authenticable-by-email.port';
import { LoginUseCase } from './login.usecase';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { TokenProviderPort } from '../ports/outbound/token-provider.port';
import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';

const makeStubs = () => ({
  findAuthenticatableByEmailPortStub: {
    findAuthenticatableByEmail: jest.fn().mockResolvedValue({
      id: 'any_id',
      name: 'John Doe',
      email: 'any_email@example.com',
      passwordHash: 'hashed_password',
      isActive: true,
      role: 'EMPLOYEE',
    }),
  } satisfies FindAuthenticatableByEmailPort,
  comparePasswordPortStub: {
    compare: jest.fn().mockResolvedValue(true),
  } satisfies CompareHashPort,
  tokenProviderPortStub: {
    generateToken: jest.fn().mockReturnValue({
      token: 'any_token',
    }),
  } satisfies TokenProviderPort<AuthenticatableUser>,
});

const makeSut = (): SutTypes => {
  const {
    findAuthenticatableByEmailPortStub,
    comparePasswordPortStub,
    tokenProviderPortStub,
  } = makeStubs();
  const sut = new LoginUseCase(
    findAuthenticatableByEmailPortStub,
    comparePasswordPortStub,
    tokenProviderPortStub,
  );
  return {
    sut,
    findAuthenticatableByEmailPortStub,
    comparePasswordPortStub,
    tokenProviderPortStub,
  };
};

type SutTypes = {
  sut: LoginUseCase;
  findAuthenticatableByEmailPortStub: FindAuthenticatableByEmailPort;
  comparePasswordPortStub: CompareHashPort;
  tokenProviderPortStub: TokenProviderPort<AuthenticatableUser>;
};

describe('LoginUsecase', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(LoginUseCase);
  });

  it('should call FindAuthenticatableByEmailPort with correct values', async () => {
    const { sut, findAuthenticatableByEmailPortStub } = makeSut();
    const params = {
      email: 'any_email@example.com',
      password: 'any_password',
    };

    const findAuthenticatableByEmailSpy = jest.spyOn(
      findAuthenticatableByEmailPortStub,
      'findAuthenticatableByEmail',
    );
    await sut.execute(params);
    expect(findAuthenticatableByEmailSpy).toHaveBeenCalledWith(params.email);
  });

  it('should throw AuthenticationError when user is not found', async () => {
    const { sut, findAuthenticatableByEmailPortStub } = makeSut();
    const params = {
      email: 'any_email@example.com',
      password: 'any_password',
    };
    jest
      .spyOn(findAuthenticatableByEmailPortStub, 'findAuthenticatableByEmail')
      .mockResolvedValueOnce(null);
    const promise = sut.execute(params);
    await expect(promise).rejects.toThrow(AuthenticationError);
  });

  it('should throw AuthenticationError when user is not active', async () => {
    const { sut, findAuthenticatableByEmailPortStub } = makeSut();
    const params = {
      email: 'any_email@example.com',
      password: 'any_password',
    };
    jest
      .spyOn(findAuthenticatableByEmailPortStub, 'findAuthenticatableByEmail')
      .mockResolvedValueOnce({
        id: 'any_id',
        name: 'John Doe',
        email: 'any_email@example.com',
        passwordHash: 'hashed_password',
        isActive: false,
        role: 'EMPLOYEE',
      });
    const promise = sut.execute(params);
    await expect(promise).rejects.toThrow(AuthenticationError);
  });

  it('should call ComparePasswordPort with correct values', async () => {
    const { sut, comparePasswordPortStub } = makeSut();
    const params = {
      email: 'any_email@example.com',
      password: 'any_password',
    };
    const comparePasswordSpy = jest.spyOn(comparePasswordPortStub, 'compare');
    await sut.execute(params);
    expect(comparePasswordSpy).toHaveBeenCalledWith(
      params.password,
      'hashed_password',
    );
  });

  it('should throw AuthenticationError when password is incorrect', async () => {
    const { sut, comparePasswordPortStub } = makeSut();
    const params = {
      email: 'any_email@example.com',
      password: 'any_password',
    };
    jest.spyOn(comparePasswordPortStub, 'compare').mockResolvedValueOnce(false);
    const promise = sut.execute(params);
    await expect(promise).rejects.toThrow(AuthenticationError);
  });

  it('should call TokenProviderPort with correct values', async () => {
    const { sut, tokenProviderPortStub } = makeSut();
    const params = {
      email: 'any_email@example.com',
      password: 'any_password',
    };
    const tokenProviderSpy = jest.spyOn(tokenProviderPortStub, 'generateToken');
    await sut.execute(params);
    expect(tokenProviderSpy).toHaveBeenCalledWith({
      id: 'any_id',
      name: 'John Doe',
      email: 'any_email@example.com',
      role: 'EMPLOYEE',
      isActive: true,
    });
  });

  it('should return the token from the token provider', async () => {
    const { sut, tokenProviderPortStub } = makeSut();
    const params = {
      email: 'any_email@example.com',
      password: 'any_password',
    };
    jest.spyOn(tokenProviderPortStub, 'generateToken').mockReturnValueOnce({
      token: 'any_token',
    });
    const token = await sut.execute(params);
    expect(token).toEqual({ token: 'any_token' });
  });
});
