import { DeleteResetTokenByOwnerIdPort } from '@modules/auth/application/ports/outbound/delete-reset-token-by-owner-id.port';
import { FindResetTokenByHashPort } from '@modules/auth/application/ports/outbound/find-reset-token-by-hash.port';
import { FindResetTokenByOwnerIdPort } from '@modules/auth/application/ports/outbound/find-reset-token-by-owner-id.port';
import { UpsertResetTokenPort } from '@modules/auth/application/ports/outbound/upsert-reset-token.port';
import { PasswordResetToken } from '@modules/auth/domain/models/password-reset-token.model';
import {
  PasswordResetTokenDocument,
  PasswordResetTokenMongooseModel,
} from './password-reset-token.schema';
import {
  mapPasswordResetTokenDocument,
  mapPasswordResetTokenToPersistence,
} from './password-reset-token.mapper';

/**
 * Store de tokens de reset (auth-owned, ADR 0007).
 *
 * Persiste exatamente o `tokenHash` recebido — nunca chama o hasher.
 * Um registro por owner (`upsertByOwnerId` = last-wins).
 */
export class PasswordResetTokenMongooseRepository
  implements
    FindResetTokenByOwnerIdPort,
    FindResetTokenByHashPort,
    UpsertResetTokenPort,
    DeleteResetTokenByOwnerIdPort
{
  constructor(private readonly model: PasswordResetTokenMongooseModel) {}

  async findByOwnerId(ownerId: string): Promise<PasswordResetToken | null> {
    const document = await this.model.findOne({ ownerId }).lean();
    if (!document) return null;

    return mapPasswordResetTokenDocument(
      document as PasswordResetTokenDocument,
    );
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const document = await this.model.findOne({ tokenHash }).lean();
    if (!document) return null;

    return mapPasswordResetTokenDocument(
      document as PasswordResetTokenDocument,
    );
  }

  async upsertByOwnerId(token: PasswordResetToken): Promise<void> {
    await this.model.updateOne(
      { ownerId: token.ownerId },
      { $set: mapPasswordResetTokenToPersistence(token) },
      { upsert: true },
    );
  }

  async deleteByOwnerId(ownerId: string): Promise<void> {
    await this.model.deleteOne({ ownerId });
  }
}
