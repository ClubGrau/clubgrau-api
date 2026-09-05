/** Atualiza credenciais do employee de forma atômica ($set password + $inc sessionVersion). */
export interface UpdateEmployeeCredentialsPort {
  updateCredentials(ownerId: string, passwordHash: string): Promise<void>;
}
