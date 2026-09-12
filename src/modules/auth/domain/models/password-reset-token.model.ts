/**
 * Snapshot de um token de reset de senha (write model — NÃO é entidade).
 *
 * Auth-owned (ADR 0007): o token de reset vive na collection do módulo `auth`,
 * não é um conceito de employees. `tokenHash` é o HMAC-SHA256 do token cru
 * (ADR 0010) — o valor cru nunca é persistido.
 */
export type PasswordResetToken = {
  ownerId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
};
