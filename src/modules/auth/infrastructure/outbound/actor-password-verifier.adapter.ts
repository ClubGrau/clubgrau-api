import { FindAuthenticatableByIdPort } from '@modules/auth/application/ports/outbound/find-authenticatable-by-id.port';
import { VerifyActorPasswordPort } from '@modules/customers/application/ports/outbound/verify-actor-password.port';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';

export class ActorPasswordVerifierAdapter implements VerifyActorPasswordPort {
  constructor(
    private readonly findAuthenticatableById: FindAuthenticatableByIdPort,
    private readonly compareHash: CompareHashPort,
  ) {}

  async verify(actorId: string, password: string): Promise<boolean> {
    if (!actorId || !password) {
      return false;
    }

    const user =
      await this.findAuthenticatableById.findAuthenticatableById(actorId);

    if (!user || !user.loginCapable || !user.passwordHash) {
      return false;
    }

    try {
      return await this.compareHash.compare(password, user.passwordHash);
    } catch {
      return false;
    }
  }
}
