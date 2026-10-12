import {
  ReopenIndicationOriginDto,
  ReopenIndicationOriginResultDto,
} from '../../dtos/reopen-indication-origin.dto';

export interface ReopenIndicationOriginPort {
  execute(
    params: ReopenIndicationOriginDto,
  ): Promise<ReopenIndicationOriginResultDto>;
}
