import {
  CorrectIndicationOriginNameDto,
  CorrectIndicationOriginNameResultDto,
} from '../../dtos/correct-indication-origin-name.dto';

export interface CorrectIndicationOriginNamePort {
  execute(
    params: CorrectIndicationOriginNameDto,
  ): Promise<CorrectIndicationOriginNameResultDto>;
}
