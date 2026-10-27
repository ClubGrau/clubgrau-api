import { NameByIdReadModel } from '../../dtos/get-customers.dto';

/** Driven port: nomes de customers em lote (referrer de uma indicação amigo). */
export interface FindCustomerNamesByIdsPort {
  findNamesByIds(ids: string[]): Promise<NameByIdReadModel[]>;
}
