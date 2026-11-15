import { LivenessDto } from '../../dtos/liveness.dto';

export interface CheckLivenessPort {
  execute(): Promise<LivenessDto>;
}
