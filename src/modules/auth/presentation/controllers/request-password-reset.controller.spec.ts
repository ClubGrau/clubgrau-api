import { RequestPasswordResetPort } from '@modules/auth/application/ports/inbound/request-password-reset.port';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { RequestPasswordResetController } from './request-password-reset.controller';

const makeStubs = () => ({
  requestPasswordResetPortStub: {
    execute: jest.fn().mockResolvedValue({ ok: true }),
  } satisfies RequestPasswordResetPort,
});

const makeSut = (): SutTypes => {
  const { requestPasswordResetPortStub } = makeStubs();
  const sut = new RequestPasswordResetController(requestPasswordResetPortStub);
  return { sut, requestPasswordResetPortStub };
};

type SutTypes = {
  sut: RequestPasswordResetController;
  requestPasswordResetPortStub: RequestPasswordResetPort;
};

describe('RequestPasswordResetController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(RequestPasswordResetController);
  });

  it('should return 400 and not call the port when email is missing', async () => {
    const { sut, requestPasswordResetPortStub } = makeSut();

    const httpResponse = await sut.handle({});

    expect(httpResponse.statusCode).toBe(400);
    expect(httpResponse.body).toEqual({
      error: new MissingParamError('email').message,
    });
    expect(requestPasswordResetPortStub.execute).not.toHaveBeenCalled();
  });

  it('should call the port with the email', async () => {
    const { sut, requestPasswordResetPortStub } = makeSut();

    await sut.handle({ email: 'any_email@example.com' });

    expect(requestPasswordResetPortStub.execute).toHaveBeenCalledWith({
      email: 'any_email@example.com',
    });
  });

  it('should return 200 { data: { ok: true } } when the port resolves', async () => {
    const { sut } = makeSut();

    const httpResponse = await sut.handle({ email: 'any_email@example.com' });

    expect(httpResponse.statusCode).toBe(200);
    expect(httpResponse.body).toEqual({ data: { ok: true } });
  });

  it('should return 500 when the port throws unexpectedly', async () => {
    const { sut, requestPasswordResetPortStub } = makeSut();
    jest
      .spyOn(requestPasswordResetPortStub, 'execute')
      .mockRejectedValueOnce(new Error('unexpected'));

    const httpResponse = await sut.handle({ email: 'any_email@example.com' });

    expect(httpResponse.statusCode).toBe(500);
    expect(httpResponse.body).toEqual({ error: 'unexpected' });
  });
});
