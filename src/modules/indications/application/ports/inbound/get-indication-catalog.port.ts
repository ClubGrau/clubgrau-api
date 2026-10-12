import { GetIndicationCatalogResultDto } from '../../dtos/get-indication-catalog.dto';

export interface GetIndicationCatalogPort {
  execute(): Promise<GetIndicationCatalogResultDto>;
}
