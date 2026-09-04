import { PasswordResetToken } from '@modules/auth/domain/models/password-reset-token.model';

/** Store de tokens de reset — leitura por owner (auth-owned, ADR 0007). */
export interface FindResetTokenByOwnerIdPort {
  findByOwnerId(ownerId: string): Promise<PasswordResetToken | null>;
}
