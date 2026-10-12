import { IndicationCategories } from '@modules/indications/domain/indication-categories';
import {
  GetIndicationCatalogResultDto,
  IndicationCatalogOriginDto,
} from '../dtos/get-indication-catalog.dto';
import { compareByPositionThenId } from '@shared/application/helpers/compare-by-position-then-id';
import { GetIndicationCatalogPort } from '../ports/inbound/get-indication-catalog.port';
import {
  IndicationOriginCatalogRow,
  ListIndicationOriginsPort,
} from '../ports/outbound/list-indication-origins.port';

export class GetIndicationCatalogQuery implements GetIndicationCatalogPort {
  constructor(private readonly origins: ListIndicationOriginsPort) {}

  async execute(): Promise<GetIndicationCatalogResultDto> {
    const rows = await this.origins.list();
    const categories = IndicationCategories.list();

    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        holdsOrigins: category.holdsOrigins,
        origins: category.holdsOrigins
          ? sortOriginsForCategory(rows, category.id).map(toOriginDto)
          : [],
      })),
    };
  }
}

function sortOriginsForCategory(
  rows: IndicationOriginCatalogRow[],
  categoryId: string,
): IndicationOriginCatalogRow[] {
  return rows
    .filter((row) => row.categoryId === categoryId)
    .filter((row) => rowIsCatalogOrigin(row))
    .slice()
    .sort(compareByPositionThenId);
}

function rowIsCatalogOrigin(row: IndicationOriginCatalogRow): boolean {
  const category = IndicationCategories.find(row.categoryId);
  return category !== undefined && category.holdsOrigins;
}

function toOriginDto(
  row: IndicationOriginCatalogRow,
): IndicationCatalogOriginDto {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    active: row.active,
  };
}
