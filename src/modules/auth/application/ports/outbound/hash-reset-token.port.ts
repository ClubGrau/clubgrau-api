/**
 * Porta de saída para o hashing determinístico do token de reset.
 *
 * Implementada por um adapter HMAC-SHA256 com pepper dedicado (ADR 0010) —
 * NÃO usa EncrypterPort/bcrypt e NÃO faz fallback para JWT_SECRET.
 */
export interface HashResetTokenPort {
  hash(raw: string): string;
}
