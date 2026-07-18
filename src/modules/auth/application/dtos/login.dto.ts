/** Input do caso de uso Login (entrada da application). */
export interface LoginDto {
  email: string;
  password: string;
}

/** Output do caso de uso Login (saída da application). */
export interface LoginResultDto {
  token: string;
}
