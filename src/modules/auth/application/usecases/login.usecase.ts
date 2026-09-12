import { FindAuthenticatableByEmailPort } from '@modules/auth/application/ports/outbound/find-authenticable-by-email.port';
import { LoginDto, LoginResultDto } from '../dtos/login.dto';
import { AuthenticationError } from '@modules/auth/domain/errors/auth.errors';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { TokenProviderPort } from '../ports/outbound/token-provider.port';
import { TokenPayload } from '@modules/auth/domain/models/token-payload.model';

export class LoginUseCase {
  constructor(
    private readonly findAuthenticatableByEmailPort: FindAuthenticatableByEmailPort,
    private readonly compareHashPort: CompareHashPort,
    private readonly tokenProviderPort: TokenProviderPort<TokenPayload>,
  ) {}

  async execute(params: LoginDto): Promise<LoginResultDto> {
    const user =
      await this.findAuthenticatableByEmailPort.findAuthenticatableByEmail(
        params.email,
      );

    if (!user || !user.loginCapable) {
      throw new AuthenticationError();
    }

    const passwordHash = user.passwordHash!;
    const isPasswordValid = await this.compareHashPort.compare(
      params.password,
      passwordHash,
    );

    if (!isPasswordValid) {
      throw new AuthenticationError();
    }

    const { token } = this.tokenProviderPort.generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      sessionVersion: user.sessionVersion,
    });

    return { token };
  }
}
