import {
  EndIndicationOriginDto,
  EndIndicationOriginResultDto,
} from '../../dtos/end-indication-origin.dto';

export interface EndIndicationOriginPort {
  execute(
    params: EndIndicationOriginDto,
  ): Promise<EndIndicationOriginResultDto>;
}
