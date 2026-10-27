import { NameByIdReadModel } from '../../dtos/get-customers.dto';

/** Driven port: nomes de origens em lote. Implementado pelo módulo indications. */
export interface FindIndicationOriginNamesByIdsPort {
  findOriginNamesByIds(ids: string[]): Promise<NameByIdReadModel[]>;
}
