/** Corpo cru (não validado) de `POST /auth/password-reset/complete`. */
export type CompletePasswordResetRequest = {
  token?: string;
  password?: string;
  passwordConfirmation?: string;
};
