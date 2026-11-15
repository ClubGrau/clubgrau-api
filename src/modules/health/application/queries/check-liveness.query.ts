import { LivenessDto } from '../dtos/liveness.dto';
import { CheckLivenessPort } from '../ports/inbound/check-liveness.port';

export class CheckLivenessQuery implements CheckLivenessPort {
  async execute(): Promise<LivenessDto> {
    return { status: 'ok' };
  }
}
