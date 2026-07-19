import bcrypt from 'bcrypt';
import { CompareHashPort } from '../../../application/ports/compare-hash.port';
import { EncrypterPort } from '../../../application/ports/encrypter.port';

export class BcryptAdapter implements EncrypterPort, CompareHashPort {
  async encrypt(value: string): Promise<string> {
    const salt = 10;
    const hashedValue = await bcrypt.hash(value, salt);
    return hashedValue;
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
