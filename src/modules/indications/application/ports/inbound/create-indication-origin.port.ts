import {
  CreateIndicationOriginDto,
  CreateIndicationOriginResultDto,
} from '../../dtos/create-indication-origin.dto';

export interface CreateIndicationOriginPort {
  execute(
    params: CreateIndicationOriginDto,
  ): Promise<CreateIndicationOriginResultDto>;
}
