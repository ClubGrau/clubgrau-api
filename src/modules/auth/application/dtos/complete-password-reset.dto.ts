/** Input do caso de uso CompletePasswordReset (entrada da application). */
export interface CompletePasswordResetDto {
  token: string;
  password: string;
  passwordConfirmation: string;
}

/** Output do caso de uso CompletePasswordReset (saída da application). */
export interface CompletePasswordResetResultDto {
  id: string;
}
