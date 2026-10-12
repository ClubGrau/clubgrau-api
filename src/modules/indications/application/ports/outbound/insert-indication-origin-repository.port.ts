import { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';

export interface InsertIndicationOriginRepositoryPort {
  insert(snapshot: IndicationOriginSnapshot): Promise<{ id: string }>;
}
