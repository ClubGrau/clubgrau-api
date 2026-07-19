import { LoginResultDto } from '../../dtos/login.dto';

export interface TokenProviderPort<T extends object> {
  generateToken(payload: T): LoginResultDto;
}
