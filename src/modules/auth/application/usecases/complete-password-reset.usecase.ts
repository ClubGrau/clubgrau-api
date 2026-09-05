import {
  InvalidOrExpiredTokenError,
  PasswordResetedNotMatchError,
} from '@modules/auth/domain/errors/auth.errors';
import { Password } from '@shared/domain/value-object';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import {
  CompletePasswordResetDto,
  CompletePasswordResetResultDto,
} from '../dtos/complete-password-reset.dto';
import { CompletePasswordResetPort } from '../ports/inbound/complete-password-reset.port';
import { DeleteResetTokenByOwnerIdPort } from '../ports/outbound/delete-reset-token-by-owner-id.port';
import { FindAuthenticatableByIdPort } from '../ports/outbound/find-authenticatable-by-id.port';
import { FindResetTokenByHashPort } from '../ports/outbound/find-reset-token-by-hash.port';
import { HashResetTokenPort } from '../ports/outbound/hash-reset-token.port';
import { UpdateEmployeeCredentialsPort } from '../ports/outbound/update-employee-credentials.port';

export class CompletePasswordResetUsecase implements CompletePasswordResetPort {
  constructor(
    private readonly findResetTokenByHashPort: FindResetTokenByHashPort,
    private readonly findAuthenticatableByIdPort: FindAuthenticatableByIdPort,
    private readonly deleteResetTokenByOwnerIdPort: DeleteResetTokenByOwnerIdPort,
    private readonly updateEmployeeCredentialsPort: UpdateEmployeeCredentialsPort,
    private readonly encrypterPort: EncrypterPort,
    private readonly hashResetTokenPort: HashResetTokenPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    params: CompletePasswordResetDto,
  ): Promise<CompletePasswordResetResultDto> {
    Password.create(params.password);

    if (params.password !== params.passwordConfirmation) {
      throw new PasswordResetedNotMatchError();
    }

    const tokenHash = this.hashResetTokenPort.hash(params.token);
    const resetToken =
      await this.findResetTokenByHashPort.findByTokenHash(tokenHash);

    if (!resetToken) {
      throw new InvalidOrExpiredTokenError();
    }

    const now = this.now();
    if (resetToken.expiresAt.getTime() <= now.getTime()) {
      await this.deleteResetTokenByOwnerIdPort.deleteByOwnerId(
        resetToken.ownerId,
      );
      throw new InvalidOrExpiredTokenError();
    }

    const user = await this.findAuthenticatableByIdPort.findAuthenticatableById(
      resetToken.ownerId,
    );

    if (!user || !user.loginCapable) {
      await this.deleteResetTokenByOwnerIdPort.deleteByOwnerId(
        resetToken.ownerId,
      );
      throw new InvalidOrExpiredTokenError();
    }

    const passwordHash = await this.encrypterPort.encrypt(params.password);
    await this.updateEmployeeCredentialsPort.updateCredentials(
      resetToken.ownerId,
      passwordHash,
    );
    await this.deleteResetTokenByOwnerIdPort.deleteByOwnerId(
      resetToken.ownerId,
    );

    return { id: resetToken.ownerId };
  }
}
