import { LoginDto, LoginResultDto } from '../../dtos/login.dto';

export interface LoginPort {
  execute(params: LoginDto): Promise<LoginResultDto>;
}
