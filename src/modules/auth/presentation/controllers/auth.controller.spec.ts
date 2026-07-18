import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { AuthController } from './auth.controller';
import { LoginPort } from '@modules/auth/application/ports/inbound/login.port';

const makeStubs = () => ({
  loginPortStub: {
    execute: jest.fn().mockResolvedValue({
      token: 'valid_token',
    }),
  } satisfies LoginPort,
});

const makeSut = (): SutTypes => {
  const { loginPortStub } = makeStubs();
  const sut = new AuthController(loginPortStub);
  return {
    sut,
    loginPortStub,
  };
};

type SutTypes = {
  sut: AuthController;
  loginPortStub: LoginPort;
};

describe('AuthController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(AuthController);
  });

  it('should return 400 if no email is provided', async () => {
    const { sut } = makeSut();
    const request = {
      email: '',
      password: 'any_password',
    };
    const httpResponse = await sut.handle(request);
    expect(httpResponse.statusCode).toBe(400);
    expect(httpResponse.body).toEqual({
      error: new MissingParamError('email').message,
    });
  });

  it('should return 400 if no password is provided', async () => {
    const { sut } = makeSut();
    const request = {
      email: 'any_email@example.com',
      password: '',
    };
    const httpResponse = await sut.handle(request);
    expect(httpResponse.statusCode).toBe(400);
    expect(httpResponse.body).toEqual({
      error: new MissingParamError('password').message,
    });
  });

  it('should call LoginPort with correct values', async () => {
    const { sut, loginPortStub } = makeSut();
    const request = {
      email: 'any_email@example.com',
      password: 'any_password',
    };
    const loginSpy = jest.spyOn(loginPortStub, 'execute');
    await sut.handle(request);
    expect(loginSpy).toHaveBeenCalledWith({
      email: 'any_email@example.com',
      password: 'any_password',
    });
  });
});
