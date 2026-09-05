import { FindAuthenticatableByEmailPort } from '../ports/outbound/find-authenticable-by-email.port';
import { FindResetTokenByOwnerIdPort } from '../ports/outbound/find-reset-token-by-owner-id.port';
import { UpsertResetTokenPort } from '../ports/outbound/upsert-reset-token.port';
import { HashResetTokenPort } from '../ports/outbound/hash-reset-token.port';
import { GenerateRawResetTokenPort } from '../ports/outbound/generate-raw-reset-token.port';
import { MailerPort } from '@shared/application/ports/mailer.port';
import { RequestPasswordResetPort } from '../ports/inbound/request-password-reset.port';
import {
  RequestPasswordResetDto,
  RequestPasswordResetResultDto,
} from '../dtos/request-password-reset.dto';

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos desde o issuedAt
const TTL_MS = 30 * 60 * 1000; // 30 minutos até o expiresAt

/**
 * Solicita o reset de senha (ADR 0011: envia PRIMEIRO, persiste DEPOIS).
 *
 * Sempre retorna `{ ok: true }` opaco. Email desconhecido, usuário sem
 * `loginCapable` e dentro do cooldown não geram token, envio ou upsert.
 * Falha de envio não toca o registro anterior e ainda retorna `{ ok: true }`.
 */
export class RequestPasswordResetUsecase implements RequestPasswordResetPort {
  constructor(
    private readonly findAuthenticatableByEmailPort: FindAuthenticatableByEmailPort,
    private readonly findResetTokenByOwnerIdPort: FindResetTokenByOwnerIdPort,
    private readonly upsertResetTokenPort: UpsertResetTokenPort,
    private readonly hashResetTokenPort: HashResetTokenPort,
    private readonly generateRawResetTokenPort: GenerateRawResetTokenPort,
    private readonly mailerPort: MailerPort,
    private readonly frontendPublicOrigin: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    params: RequestPasswordResetDto,
  ): Promise<RequestPasswordResetResultDto> {
    const user =
      await this.findAuthenticatableByEmailPort.findAuthenticatableByEmail(
        params.email,
      );

    if (!user || !user.loginCapable) {
      return { ok: true };
    }

    const now = this.now();

    const existing = await this.findResetTokenByOwnerIdPort.findByOwnerId(
      user.id,
    );
    if (existing && now.getTime() - existing.issuedAt.getTime() < COOLDOWN_MS) {
      return { ok: true };
    }

    const raw = this.generateRawResetTokenPort.generate();
    const resetUrl = `${this.frontendPublicOrigin}/reset-password?token=${raw}`;

    try {
      await this.mailerPort.send({
        to: params.email,
        template: 'password-reset',
        vars: { resetUrl },
      });
    } catch {
      // Nunca logar o token cru ou a resetUrl. Registro anterior fica intacto.
      console.error('Failed to send password-reset email');
      return { ok: true };
    }

    const tokenHash = this.hashResetTokenPort.hash(raw);
    await this.upsertResetTokenPort.upsertByOwnerId({
      ownerId: user.id,
      tokenHash,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + TTL_MS),
    });

    return { ok: true };
  }
}
