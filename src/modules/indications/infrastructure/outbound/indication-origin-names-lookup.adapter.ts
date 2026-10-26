import { FindIndicationOriginNamesByIdsPort as CustomersFindIndicationOriginNamesByIdsPort } from '@modules/customers/application/ports/outbound/find-indication-origin-names-by-ids.port';
import { FindIndicationOriginNamesByIdsPort } from '@modules/indications/application/ports/outbound/find-indication-origin-names-by-ids.port';

export class IndicationOriginNamesLookupAdapter implements CustomersFindIndicationOriginNamesByIdsPort {
  constructor(private readonly origins: FindIndicationOriginNamesByIdsPort) {}

  findOriginNamesByIds(ids: string[]) {
    return this.origins.findOriginNamesByIds(ids);
  }
}
