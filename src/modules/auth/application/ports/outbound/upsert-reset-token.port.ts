import { PasswordResetToken } from '@modules/auth/domain/models/password-reset-token.model';

/**
 * Store de tokens de reset — grava o token (auth-owned, ADR 0007).
 *
 * Persiste exatamente o `tokenHash` recebido — nunca chama o hasher.
 * Um registro por owner (last-wins).
 */
export interface UpsertResetTokenPort {
  upsertByOwnerId(token: PasswordResetToken): Promise<void>;
}
