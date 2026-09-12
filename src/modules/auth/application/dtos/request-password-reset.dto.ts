/** Input do caso de uso RequestPasswordReset (entrada da application). */
export interface RequestPasswordResetDto {
  email: string;
}

/**
 * Output opaco do caso de uso RequestPasswordReset.
 *
 * Sempre `{ ok: true }` — não revela se o email existe, se está apto ao login,
 * se está em cooldown ou se o envio falhou. O token cru NUNCA aparece aqui.
 */
export interface RequestPasswordResetResultDto {
  ok: true;
}
