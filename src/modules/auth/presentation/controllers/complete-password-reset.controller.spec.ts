import { CompletePasswordResetPort } from '@modules/auth/application/ports/inbound/complete-password-reset.port';
import {
  InvalidOrExpiredTokenError,
  PasswordResetedNotMatchError,
} from '@modules/auth/domain/errors/auth.errors';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { CompletePasswordResetController } from './complete-password-reset.controller';

const makeStubs = () => ({
  completePasswordResetPortStub: {
    execute: jest.fn().mockResolvedValue({ id: 'owner_id' }),
  } satisfies CompletePasswordResetPort,
});

const makeSut = (): SutTypes => {
  const { completePasswordResetPortStub } = makeStubs();
  const sut = new CompletePasswordResetController(
    completePasswordResetPortStub,
  );
  return { sut, completePasswordResetPortStub };
};

type SutTypes = {
  sut: CompletePasswordResetController;
  completePasswordResetPortStub: CompletePasswordResetPort;
};

const makeValidRequest = () => ({
  token: 'raw-token',
  password: 'P@ssword123',
  passwordConfirmation: 'P@ssword123',
});

describe('CompletePasswordResetController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CompletePasswordResetController);
  });

  it.each(['token', 'password', 'passwordConfirmation'] as const)(
    'should return 400 and not call the port when %s is missing',
    async (field) => {
      const { sut, completePasswordResetPortStub } = makeSut();
      const request = { ...makeValidRequest(), [field]: undefined };

      const httpResponse = await sut.handle(request);

      expect(httpResponse.statusCode).toBe(400);
      expect(httpResponse.body).toEqual({
        error: new MissingParamError(field).message,
      });
      expect(completePasswordResetPortStub.execute).not.toHaveBeenCalled();
    },
  );

  it('should call the port with token, password and passwordConfirmation', async () => {
    const { sut, completePasswordResetPortStub } = makeSut();
    const request = makeValidRequest();

    await sut.handle(request);

    expect(completePasswordResetPortStub.execute).toHaveBeenCalledWith({
      token: 'raw-token',
      password: 'P@ssword123',
      passwordConfirmation: 'P@ssword123',
    });
  });

  it('should return 200 { data: { id } } when the port resolves', async () => {
    const { sut } = makeSut();

    const httpResponse = await sut.handle(makeValidRequest());

    expect(httpResponse.statusCode).toBe(200);
    expect(httpResponse.body).toEqual({ data: { id: 'owner_id' } });
  });

  it('should return 400 when the port throws PasswordResetedNotMatchError', async () => {
    const { sut, completePasswordResetPortStub } = makeSut();
    jest
      .spyOn(completePasswordResetPortStub, 'execute')
      .mockRejectedValueOnce(new PasswordResetedNotMatchError());

    const httpResponse = await sut.handle(makeValidRequest());

    expect(httpResponse.statusCode).toBe(400);
    expect(httpResponse.body).toEqual({
      error: 'Password and passwordConfirmation do not match',
    });
  });

  it('should return 400 when the port throws InvalidOrExpiredTokenError', async () => {
    const { sut, completePasswordResetPortStub } = makeSut();
    jest
      .spyOn(completePasswordResetPortStub, 'execute')
      .mockRejectedValueOnce(new InvalidOrExpiredTokenError());

    const httpResponse = await sut.handle(makeValidRequest());

    expect(httpResponse.statusCode).toBe(400);
    expect(httpResponse.body).toEqual({
      error: 'Invalid or expired link',
    });
  });

  it('should return 500 when the port throws unexpectedly', async () => {
    const { sut, completePasswordResetPortStub } = makeSut();
    jest
      .spyOn(completePasswordResetPortStub, 'execute')
      .mockRejectedValueOnce(new Error('unexpected'));

    const httpResponse = await sut.handle(makeValidRequest());

    expect(httpResponse.statusCode).toBe(500);
    expect(httpResponse.body).toEqual({ error: 'unexpected' });
  });
});
