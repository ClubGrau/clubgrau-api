import { FindIndicationOriginPort } from '@modules/customers/application/ports/outbound/find-indication-origin.port';
import { IndicationOriginSnapshotMapper } from '@modules/indications/application/mappers/indication-origin-snapshot.mapper';
import { FindIndicationOriginByIdPort } from '@modules/indications/application/ports/outbound/find-indication-origin-by-id.port';

export class IndicationOriginLookupAdapter implements FindIndicationOriginPort {
  constructor(private readonly origins: FindIndicationOriginByIdPort) {}

  async findOrigin(id: string) {
    const snapshot = await this.origins.findById(id);
    if (snapshot === null) {
      return null;
    }

    const entity = IndicationOriginSnapshotMapper.toEntity(snapshot);
    return {
      id: entity.id,
      categoryId: entity.categoryId,
      active: entity.active,
    };
  }
}
