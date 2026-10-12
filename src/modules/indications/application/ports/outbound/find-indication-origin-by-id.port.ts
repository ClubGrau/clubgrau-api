import { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';

export interface FindIndicationOriginByIdPort {
  findById(id: string): Promise<IndicationOriginSnapshot | null>;
}
