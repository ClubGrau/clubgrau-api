import { createHmac } from 'crypto';
import envs from '@configs/envs';
import { HashResetTokenPort } from '@modules/auth/application/ports/outbound/hash-reset-token.port';

/**
 * Hasher determinístico do token de reset: HMAC-SHA256 com pepper dedicado
 * (ADR 0010). Não usa bcrypt/EncrypterPort e NÃO faz fallback para JWT_SECRET.
 */
export class HmacResetTokenHasher implements HashResetTokenPort {
  hash(raw: string): string {
    const pepper = this.getPepper();
    return createHmac('sha256', pepper).update(raw).digest('hex');
  }

  private getPepper(): string {
    const pepper = envs.passwordResetPepper;
    if (!pepper) {
      throw new Error(
        'PASSWORD_RESET_PEPPER is not set in environment variables',
      );
    }
    return pepper;
  }
}
