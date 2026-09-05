import {
  InvalidOrExpiredTokenError,
  PasswordResetedNotMatchError,
} from '@modules/auth/domain/errors/auth.errors';
import { InvalidPasswordError } from '@shared/domain/value-object';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import { DeleteResetTokenByOwnerIdPort } from '../ports/outbound/delete-reset-token-by-owner-id.port';
import { FindAuthenticatableByIdPort } from '../ports/outbound/find-authenticatable-by-id.port';
import { FindResetTokenByHashPort } from '../ports/outbound/find-reset-token-by-hash.port';
import { HashResetTokenPort } from '../ports/outbound/hash-reset-token.port';
import { UpdateEmployeeCredentialsPort } from '../ports/outbound/update-employee-credentials.port';
import { CompletePasswordResetUsecase } from './complete-password-reset.usecase';

const FIXED_NOW = new Date('2026-01-01T12:00:00.000Z');
const VALID_PASSWORD = 'P@ssword123';

const makeResetToken = (
  overrides: Partial<{
    ownerId: string;
    tokenHash: string;
    issuedAt: Date;
    expiresAt: Date;
  }> = {},
) => ({
  ownerId: 'owner_id',
  tokenHash: 'hashed-token',
  issuedAt: new Date(FIXED_NOW.getTime() - 5 * 60 * 1000),
  expiresAt: new Date(FIXED_NOW.getTime() + 25 * 60 * 1000),
  ...overrides,
});

const makeLoginCapableUser = () => ({
  id: 'owner_id',
  name: 'John Doe',
  email: 'john@example.com',
  passwordHash: 'old-hash',
  status: 'ACTIVE' as const,
  role: 'EMPLOYEE' as const,
  loginCapable: true,
  sessionVersion: 0,
});

const makeStubs = () => ({
  findResetTokenByHashPortStub: {
    findByTokenHash: jest.fn().mockResolvedValue(makeResetToken()),
  } satisfies FindResetTokenByHashPort,
  findAuthenticatableByIdPortStub: {
    findAuthenticatableById: jest
      .fn()
      .mockResolvedValue(makeLoginCapableUser()),
  } satisfies FindAuthenticatableByIdPort,
  deleteResetTokenByOwnerIdPortStub: {
    deleteByOwnerId: jest.fn().mockResolvedValue(undefined),
  } satisfies DeleteResetTokenByOwnerIdPort,
  updateEmployeeCredentialsPortStub: {
    updateCredentials: jest.fn().mockResolvedValue(undefined),
  } satisfies UpdateEmployeeCredentialsPort,
  encrypterPortStub: {
    encrypt: jest.fn().mockResolvedValue('new-password-hash'),
  } satisfies EncrypterPort,
  hashResetTokenPortStub: {
    hash: jest.fn().mockReturnValue('hashed-token'),
  } satisfies HashResetTokenPort,
});

const makeSut = (): SutTypes => {
  const stubs = makeStubs();
  const sut = new CompletePasswordResetUsecase(
    stubs.findResetTokenByHashPortStub,
    stubs.findAuthenticatableByIdPortStub,
    stubs.deleteResetTokenByOwnerIdPortStub,
    stubs.updateEmployeeCredentialsPortStub,
    stubs.encrypterPortStub,
    stubs.hashResetTokenPortStub,
    () => FIXED_NOW,
  );
  return { sut, ...stubs };
};

type SutTypes = {
  sut: CompletePasswordResetUsecase;
  findResetTokenByHashPortStub: FindResetTokenByHashPort;
  findAuthenticatableByIdPortStub: FindAuthenticatableByIdPort;
  deleteResetTokenByOwnerIdPortStub: DeleteResetTokenByOwnerIdPort;
  updateEmployeeCredentialsPortStub: UpdateEmployeeCredentialsPort;
  encrypterPortStub: EncrypterPort;
  hashResetTokenPortStub: HashResetTokenPort;
};

const makeValidParams = () => ({
  token: 'raw-token',
  password: VALID_PASSWORD,
  passwordConfirmation: VALID_PASSWORD,
});

describe('CompletePasswordResetUsecase', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CompletePasswordResetUsecase);
  });

  it('should reject weak password before token lookup', async () => {
    const { sut, hashResetTokenPortStub, findResetTokenByHashPortStub } =
      makeSut();
    const params = {
      token: 'raw-token',
      password: 'weak',
      passwordConfirmation: 'weak',
    };

    await expect(sut.execute(params)).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
    expect(hashResetTokenPortStub.hash).not.toHaveBeenCalled();
    expect(findResetTokenByHashPortStub.findByTokenHash).not.toHaveBeenCalled();
  });

  it('should reject password mismatch before token lookup', async () => {
    const { sut, hashResetTokenPortStub, findResetTokenByHashPortStub } =
      makeSut();
    const params = {
      token: 'raw-token',
      password: VALID_PASSWORD,
      passwordConfirmation: 'P@ssword456',
    };

    await expect(sut.execute(params)).rejects.toBeInstanceOf(
      PasswordResetedNotMatchError,
    );
    expect(hashResetTokenPortStub.hash).not.toHaveBeenCalled();
    expect(findResetTokenByHashPortStub.findByTokenHash).not.toHaveBeenCalled();
  });

  it('should hash the raw token before lookup', async () => {
    const { sut, hashResetTokenPortStub } = makeSut();

    await sut.execute(makeValidParams());

    expect(hashResetTokenPortStub.hash).toHaveBeenCalledWith('raw-token');
  });

  it('should throw InvalidOrExpiredTokenError when token is not found', async () => {
    const { sut, findResetTokenByHashPortStub } = makeSut();
    jest
      .spyOn(findResetTokenByHashPortStub, 'findByTokenHash')
      .mockResolvedValueOnce(null);

    await expect(sut.execute(makeValidParams())).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
  });

  it('should delete token and throw when token is expired', async () => {
    const {
      sut,
      findResetTokenByHashPortStub,
      deleteResetTokenByOwnerIdPortStub,
      updateEmployeeCredentialsPortStub,
    } = makeSut();
    jest
      .spyOn(findResetTokenByHashPortStub, 'findByTokenHash')
      .mockResolvedValueOnce(
        makeResetToken({
          expiresAt: new Date(FIXED_NOW.getTime() - 1),
        }),
      );

    await expect(sut.execute(makeValidParams())).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    expect(
      deleteResetTokenByOwnerIdPortStub.deleteByOwnerId,
    ).toHaveBeenCalledWith('owner_id');
    expect(
      updateEmployeeCredentialsPortStub.updateCredentials,
    ).not.toHaveBeenCalled();
  });

  it('should delete token and throw when user is not found', async () => {
    const {
      sut,
      findAuthenticatableByIdPortStub,
      deleteResetTokenByOwnerIdPortStub,
      updateEmployeeCredentialsPortStub,
    } = makeSut();
    jest
      .spyOn(findAuthenticatableByIdPortStub, 'findAuthenticatableById')
      .mockResolvedValueOnce(null);

    await expect(sut.execute(makeValidParams())).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    expect(
      deleteResetTokenByOwnerIdPortStub.deleteByOwnerId,
    ).toHaveBeenCalledWith('owner_id');
    expect(
      updateEmployeeCredentialsPortStub.updateCredentials,
    ).not.toHaveBeenCalled();
  });

  it('should delete token and throw when user is not login capable', async () => {
    const {
      sut,
      findAuthenticatableByIdPortStub,
      deleteResetTokenByOwnerIdPortStub,
      updateEmployeeCredentialsPortStub,
    } = makeSut();
    jest
      .spyOn(findAuthenticatableByIdPortStub, 'findAuthenticatableById')
      .mockResolvedValueOnce({
        ...makeLoginCapableUser(),
        loginCapable: false,
        status: 'INACTIVE',
      });

    await expect(sut.execute(makeValidParams())).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    expect(
      deleteResetTokenByOwnerIdPortStub.deleteByOwnerId,
    ).toHaveBeenCalledWith('owner_id');
    expect(
      updateEmployeeCredentialsPortStub.updateCredentials,
    ).not.toHaveBeenCalled();
  });

  it('should encrypt password, update credentials, delete token and return id', async () => {
    const {
      sut,
      encrypterPortStub,
      updateEmployeeCredentialsPortStub,
      deleteResetTokenByOwnerIdPortStub,
    } = makeSut();

    const result = await sut.execute(makeValidParams());

    expect(encrypterPortStub.encrypt).toHaveBeenCalledWith(VALID_PASSWORD);
    expect(
      updateEmployeeCredentialsPortStub.updateCredentials,
    ).toHaveBeenCalledWith('owner_id', 'new-password-hash');
    expect(
      deleteResetTokenByOwnerIdPortStub.deleteByOwnerId,
    ).toHaveBeenCalledWith('owner_id');
    expect(result).toEqual({ id: 'owner_id' });
  });

  it('should lookup user by ownerId from the reset token', async () => {
    const { sut, findAuthenticatableByIdPortStub } = makeSut();

    await sut.execute(makeValidParams());

    expect(
      findAuthenticatableByIdPortStub.findAuthenticatableById,
    ).toHaveBeenCalledWith('owner_id');
  });
});
