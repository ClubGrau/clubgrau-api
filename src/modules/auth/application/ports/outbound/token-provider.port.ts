export interface TokenProviderPort<T extends object> {
  generateToken(payload: T): Promise<{ token: string }>;
}
