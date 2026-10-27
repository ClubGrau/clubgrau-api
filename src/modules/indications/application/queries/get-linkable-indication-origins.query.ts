import { compareByPositionThenId } from '@shared/application/helpers/compare-by-position-then-id';
import {
  GetLinkableIndicationOriginsResultDto,
  LinkableIndicationOriginDto,
} from '../dtos/get-linkable-indication-origins.dto';
import { GetLinkableIndicationOriginsPort } from '../ports/inbound/get-linkable-indication-origins.port';
import {
  IndicationOriginCatalogRow,
  ListIndicationOriginsPort,
} from '../ports/outbound/list-indication-origins.port';

export class GetLinkableIndicationOriginsQuery implements GetLinkableIndicationOriginsPort {
  constructor(private readonly origins: ListIndicationOriginsPort) {}

  async execute(): Promise<GetLinkableIndicationOriginsResultDto> {
    const rows = await this.origins.list();
    const activeRows = rows.filter((row) => row.active === true);

    const canal = sortCategory(activeRows, 'canal').map(toLinkableOrigin);
    const campanha = sortCategory(activeRows, 'campanha').map(toLinkableOrigin);

    return { origins: [...canal, ...campanha] };
  }
}

function sortCategory(
  rows: IndicationOriginCatalogRow[],
  categoryId: IndicationOriginCatalogRow['categoryId'],
): IndicationOriginCatalogRow[] {
  return rows
    .filter((row) => row.categoryId === categoryId)
    .slice()
    .sort(compareByPositionThenId);
}

function toLinkableOrigin(
  row: IndicationOriginCatalogRow,
): LinkableIndicationOriginDto {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
  };
}
