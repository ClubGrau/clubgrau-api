import { AuthenticationError } from '@modules/auth/domain/errors/auth.errors';
import { TokenPayload } from '@modules/auth/domain/models/token-payload.model';
import { LoginResultDto } from '../dtos/login.dto';
import { ReissueSessionTokenDto } from '../dtos/reissue-session-token.dto';
import { FindAuthenticatableByIdPort } from '../ports/outbound/find-authenticatable-by-id.port';
import { TokenProviderPort } from '../ports/outbound/token-provider.port';

export class ReissueSessionTokenUseCase {
  constructor(
    private readonly findAuthenticatableByIdPort: FindAuthenticatableByIdPort,
    private readonly tokenProviderPort: TokenProviderPort<TokenPayload>,
  ) {}

  async execute(params: ReissueSessionTokenDto): Promise<LoginResultDto> {
    if (!params.actorId?.trim()) {
      throw new AuthenticationError();
    }

    const user = await this.findAuthenticatableByIdPort.findAuthenticatableById(
      params.actorId,
    );

    if (!user || !user.loginCapable) {
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
