/**
 * Porta de saída para gerar o token cru de reset.
 *
 * Implementada por um adapter com `crypto.randomBytes(32).toString('base64url')`.
 * O valor cru só viaja no link do email — nunca é persistido nem retornado no HTTP.
 */
export interface GenerateRawResetTokenPort {
  generate(): string;
}
