import { PasswordResetToken } from '@modules/auth/domain/models/password-reset-token.model';

/** Store de tokens de reset — leitura pelo hash do token (auth-owned, ADR 0007). */
export interface FindResetTokenByHashPort {
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
}
