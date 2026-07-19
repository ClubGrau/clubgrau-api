import { FindAuthenticatableByEmailPort } from '@modules/auth/application/ports/outbound/find-authenticable-by-email.port';
import { LoginDto, LoginResultDto } from '../dtos/login.dto';
import { AuthenticationError } from '@modules/auth/domain/errors/auth.errors';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';

export class LoginUseCase {
  constructor(
    private readonly findAuthenticatableByEmailPort: FindAuthenticatableByEmailPort,
    private readonly compareHashPort: CompareHashPort,
  ) {}

  async execute(params: LoginDto): Promise<LoginResultDto> {
    const user =
      await this.findAuthenticatableByEmailPort.findAuthenticatableByEmail(
        params.email,
      );

    if (!user || !user.isActive) {
      throw new AuthenticationError();
    }

    await this.compareHashPort.compare(params.password, user.passwordHash);

    return { token: 'valid_token' };
  }
}
