import { FindAuthenticatableByEmailPort } from '../ports/outbound/find-authenticable-by-email.port';
import { FindResetTokenByOwnerIdPort } from '../ports/outbound/find-reset-token-by-owner-id.port';
import { UpsertResetTokenPort } from '../ports/outbound/upsert-reset-token.port';
import { HashResetTokenPort } from '../ports/outbound/hash-reset-token.port';
import { GenerateRawResetTokenPort } from '../ports/outbound/generate-raw-reset-token.port';
import { MailerPort } from '@shared/application/ports/mailer.port';
import { RequestPasswordResetUsecase } from './request-password-reset.usecase';

const FIXED_NOW = new Date('2026-01-01T12:00:00.000Z');
const FRONTEND_ORIGIN = 'https://app.example';

const makeStubs = () => ({
  findAuthenticatableByEmailPortStub: {
    findAuthenticatableByEmail: jest.fn().mockResolvedValue({
      id: 'owner_id',
      name: 'John Doe',
      email: 'any_email@example.com',
      passwordHash: 'hashed_password',
      status: 'ACTIVE',
      role: 'EMPLOYEE',
      loginCapable: true,
      sessionVersion: 0,
    }),
  } satisfies FindAuthenticatableByEmailPort,
  findResetTokenByOwnerIdPortStub: {
    findByOwnerId: jest.fn().mockResolvedValue(null),
  } satisfies FindResetTokenByOwnerIdPort,
  upsertResetTokenPortStub: {
    upsertByOwnerId: jest.fn().mockResolvedValue(undefined),
  } satisfies UpsertResetTokenPort,
  hashResetTokenPortStub: {
    hash: jest.fn().mockReturnValue('hashed-token'),
  } satisfies HashResetTokenPort,
  generateRawResetTokenPortStub: {
    generate: jest.fn().mockReturnValue('raw-token'),
  } satisfies GenerateRawResetTokenPort,
  mailerPortStub: {
    send: jest.fn().mockResolvedValue(undefined),
  } satisfies MailerPort,
});

const makeSut = (): SutTypes => {
  const stubs = makeStubs();
  const sut = new RequestPasswordResetUsecase(
    stubs.findAuthenticatableByEmailPortStub,
    stubs.findResetTokenByOwnerIdPortStub,
    stubs.upsertResetTokenPortStub,
    stubs.hashResetTokenPortStub,
    stubs.generateRawResetTokenPortStub,
    stubs.mailerPortStub,
    FRONTEND_ORIGIN,
    () => FIXED_NOW,
  );
  return { sut, ...stubs };
};

type SutTypes = {
  sut: RequestPasswordResetUsecase;
  findAuthenticatableByEmailPortStub: FindAuthenticatableByEmailPort;
  findResetTokenByOwnerIdPortStub: FindResetTokenByOwnerIdPort;
  upsertResetTokenPortStub: UpsertResetTokenPort;
  hashResetTokenPortStub: HashResetTokenPort;
  generateRawResetTokenPortStub: GenerateRawResetTokenPort;
  mailerPortStub: MailerPort;
};

const params = { email: 'any_email@example.com' };

describe('RequestPasswordResetUsecase', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(RequestPasswordResetUsecase);
  });

  it('should return { ok: true } without sending or upserting when email is unknown', async () => {
    const {
      sut,
      findAuthenticatableByEmailPortStub,
      mailerPortStub,
      upsertResetTokenPortStub,
    } = makeSut();
    jest
      .spyOn(findAuthenticatableByEmailPortStub, 'findAuthenticatableByEmail')
      .mockResolvedValueOnce(null);

    const result = await sut.execute(params);

    expect(result).toEqual({ ok: true });
    expect(mailerPortStub.send).not.toHaveBeenCalled();
    expect(upsertResetTokenPortStub.upsertByOwnerId).not.toHaveBeenCalled();
  });

  it('should return { ok: true } without sending or upserting when user is not login capable', async () => {
    const {
      sut,
      findAuthenticatableByEmailPortStub,
      mailerPortStub,
      upsertResetTokenPortStub,
    } = makeSut();
    jest
      .spyOn(findAuthenticatableByEmailPortStub, 'findAuthenticatableByEmail')
      .mockResolvedValueOnce({
        id: 'owner_id',
        name: 'John Doe',
        email: 'any_email@example.com',
        passwordHash: 'hashed_password',
        status: 'INACTIVE',
        role: 'EMPLOYEE',
        loginCapable: false,
        sessionVersion: 0,
      });

    const result = await sut.execute(params);

    expect(result).toEqual({ ok: true });
    expect(mailerPortStub.send).not.toHaveBeenCalled();
    expect(upsertResetTokenPortStub.upsertByOwnerId).not.toHaveBeenCalled();
  });

  it('should return { ok: true } without sending or upserting when within cooldown', async () => {
    const {
      sut,
      findResetTokenByOwnerIdPortStub,
      mailerPortStub,
      upsertResetTokenPortStub,
    } = makeSut();
    const oneMinuteAgo = new Date(FIXED_NOW.getTime() - 60 * 1000);
    jest
      .spyOn(findResetTokenByOwnerIdPortStub, 'findByOwnerId')
      .mockResolvedValueOnce({
        ownerId: 'owner_id',
        tokenHash: 'old-hash',
        issuedAt: oneMinuteAgo,
        expiresAt: new Date(oneMinuteAgo.getTime() + 30 * 60 * 1000),
      });

    const result = await sut.execute(params);

    expect(result).toEqual({ ok: true });
    expect(mailerPortStub.send).not.toHaveBeenCalled();
    expect(upsertResetTokenPortStub.upsertByOwnerId).not.toHaveBeenCalled();
  });

  it('should generate, send, hash and upsert when there is no outstanding row', async () => {
    const {
      sut,
      generateRawResetTokenPortStub,
      mailerPortStub,
      hashResetTokenPortStub,
      upsertResetTokenPortStub,
    } = makeSut();

    const result = await sut.execute(params);

    expect(generateRawResetTokenPortStub.generate).toHaveBeenCalledTimes(1);
    expect(mailerPortStub.send).toHaveBeenCalledWith({
      to: 'any_email@example.com',
      template: 'password-reset',
      vars: { resetUrl: 'https://app.example/reset-password?token=raw-token' },
    });
    expect(hashResetTokenPortStub.hash).toHaveBeenCalledWith('raw-token');
    expect(upsertResetTokenPortStub.upsertByOwnerId).toHaveBeenCalledWith({
      ownerId: 'owner_id',
      tokenHash: 'hashed-token',
      issuedAt: FIXED_NOW,
      expiresAt: new Date(FIXED_NOW.getTime() + 30 * 60 * 1000),
    });
    expect(result).toEqual({ ok: true });
  });

  it('should compose resetUrl from FRONTEND_PUBLIC_ORIGIN without double slash', async () => {
    const { sut, mailerPortStub } = makeSut();

    await sut.execute(params);

    expect(mailerPortStub.send).toHaveBeenCalledWith(
      expect.objectContaining({
        vars: {
          resetUrl: 'https://app.example/reset-password?token=raw-token',
        },
      }),
    );
  });

  it('should return { ok: true } and not upsert when send rejects', async () => {
    const { sut, mailerPortStub, upsertResetTokenPortStub } = makeSut();
    jest
      .spyOn(mailerPortStub, 'send')
      .mockRejectedValueOnce(new Error('mail down'));
    jest.spyOn(console, 'error').mockImplementationOnce(() => undefined);

    const result = await sut.execute(params);

    expect(result).toEqual({ ok: true });
    expect(upsertResetTokenPortStub.upsertByOwnerId).not.toHaveBeenCalled();
  });

  it('should send and upsert (replace) when outstanding row is older than 15 minutes', async () => {
    const {
      sut,
      findResetTokenByOwnerIdPortStub,
      mailerPortStub,
      upsertResetTokenPortStub,
    } = makeSut();
    const sixteenMinutesAgo = new Date(FIXED_NOW.getTime() - 16 * 60 * 1000);
    jest
      .spyOn(findResetTokenByOwnerIdPortStub, 'findByOwnerId')
      .mockResolvedValueOnce({
        ownerId: 'owner_id',
        tokenHash: 'old-hash',
        issuedAt: sixteenMinutesAgo,
        expiresAt: new Date(sixteenMinutesAgo.getTime() + 30 * 60 * 1000),
      });

    const result = await sut.execute(params);

    expect(mailerPortStub.send).toHaveBeenCalledTimes(1);
    expect(upsertResetTokenPortStub.upsertByOwnerId).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it('should pass the raw token to the hasher', async () => {
    const { sut, hashResetTokenPortStub } = makeSut();

    await sut.execute(params);

    expect(hashResetTokenPortStub.hash).toHaveBeenCalledWith('raw-token');
  });

  it('should never expose the raw token on the result DTO', async () => {
    const { sut } = makeSut();

    const result = await sut.execute(params);

    expect(JSON.stringify(result)).not.toContain('raw-token');
    expect(result).toEqual({ ok: true });
  });
});
