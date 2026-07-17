export interface EncrypterPort {
  encrypt(password: string): Promise<string>;
}
