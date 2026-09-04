/** Store de tokens de reset — remove por owner (auth-owned, ADR 0007). */
export interface DeleteResetTokenByOwnerIdPort {
  deleteByOwnerId(ownerId: string): Promise<void>;
}
