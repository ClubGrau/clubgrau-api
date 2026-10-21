import { GetLinkableIndicationOriginsResultDto } from '../../dtos/get-linkable-indication-origins.dto';

export interface GetLinkableIndicationOriginsPort {
  execute(): Promise<GetLinkableIndicationOriginsResultDto>;
}
