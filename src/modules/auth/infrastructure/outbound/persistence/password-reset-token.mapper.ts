import { PasswordResetToken } from '@modules/auth/domain/models/password-reset-token.model';
import { PasswordResetTokenDocument } from './password-reset-token.schema';

/** Maps a lean Mongoose document to the auth-owned reset token snapshot. */
export function mapPasswordResetTokenDocument(
  document: PasswordResetTokenDocument,
): PasswordResetToken {
  return {
    ownerId: document.ownerId,
    tokenHash: document.tokenHash,
    issuedAt: document.issuedAt,
    expiresAt: document.expiresAt,
  };
}

/** Maps the snapshot to the Mongoose `$set` persistence payload. */
export function mapPasswordResetTokenToPersistence(
  token: PasswordResetToken,
): Omit<PasswordResetTokenDocument, '_id'> {
  return {
    ownerId: token.ownerId,
    tokenHash: token.tokenHash,
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
  };
}
