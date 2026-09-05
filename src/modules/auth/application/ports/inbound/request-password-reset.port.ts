import {
  RequestPasswordResetDto,
  RequestPasswordResetResultDto,
} from '../../dtos/request-password-reset.dto';

export interface RequestPasswordResetPort {
  execute(
    params: RequestPasswordResetDto,
  ): Promise<RequestPasswordResetResultDto>;
}
