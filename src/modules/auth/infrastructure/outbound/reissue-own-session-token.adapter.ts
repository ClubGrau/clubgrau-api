import { ReissueSessionTokenPort } from '@modules/auth/application/ports/inbound/reissue-session-token.port';
import { AuthenticationError } from '@modules/auth/domain/errors/auth.errors';
import { ReissueOwnSessionTokenPort } from '@modules/employees/application/ports/outbound/reissue-own-session-token.port';

export class ReissueOwnSessionTokenAdapter implements ReissueOwnSessionTokenPort {
  constructor(
    private readonly reissueSessionToken: ReissueSessionTokenPort,
    private readonly authenticationFailedError: () => Error,
  ) {}

  async execute(actorId: string): Promise<{ token: string }> {
    try {
      const { token } = await this.reissueSessionToken.execute({ actorId });
      return { token };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw this.authenticationFailedError();
      }

      throw error;
    }
  }
}
