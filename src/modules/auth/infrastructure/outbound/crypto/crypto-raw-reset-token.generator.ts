import { randomBytes } from 'crypto';
import { GenerateRawResetTokenPort } from '@modules/auth/application/ports/outbound/generate-raw-reset-token.port';

/**
 * Gera o token cru de reset: 32 bytes aleatórios em base64url.
 *
 * O valor cru só viaja no link do email — nunca é persistido (apenas o HMAC
 * do hasher, ADR 0010) nem retornado no HTTP.
 */
export class CryptoRawResetTokenGenerator implements GenerateRawResetTokenPort {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
}
