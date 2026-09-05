import {
  CompletePasswordResetDto,
  CompletePasswordResetResultDto,
} from '../../dtos/complete-password-reset.dto';

export interface CompletePasswordResetPort {
  execute(
    params: CompletePasswordResetDto,
  ): Promise<CompletePasswordResetResultDto>;
}
