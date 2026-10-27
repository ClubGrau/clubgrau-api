import { IndicationOriginFacts } from '@modules/customers/domain/models/indication-origin-facts';

export interface FindIndicationOriginPort {
  findOrigin(id: string): Promise<IndicationOriginFacts | null>;
}
