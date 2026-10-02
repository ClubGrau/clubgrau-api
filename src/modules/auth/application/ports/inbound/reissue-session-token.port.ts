import { LoginResultDto } from '../../dtos/login.dto';
import { ReissueSessionTokenDto } from '../../dtos/reissue-session-token.dto';

export interface ReissueSessionTokenPort {
  execute(params: ReissueSessionTokenDto): Promise<LoginResultDto>;
}
