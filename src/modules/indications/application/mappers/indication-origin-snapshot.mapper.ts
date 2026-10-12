import { IndicationOrigin } from '@modules/indications/domain/entities/IndicationOrigin';
import { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';
import { Name } from '@shared/domain/value-object';

export class IndicationOriginSnapshotMapper {
  static toEntity(snapshot: IndicationOriginSnapshot): IndicationOrigin {
    return IndicationOrigin.reconstitute({
      id: snapshot.id,
      categoryId: snapshot.categoryId,
      name: Name.create(snapshot.name),
      nameKey: snapshot.nameKey,
      position: snapshot.position,
      createdAt: snapshot.createdAt,
      intervals: snapshot.intervals,
    });
  }
}
