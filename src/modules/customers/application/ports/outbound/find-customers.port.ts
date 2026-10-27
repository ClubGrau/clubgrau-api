import {
  FindCustomersParams,
  FindCustomersResult,
} from '../../dtos/get-customers.dto';

/** Driven port: leitura paginada de customers (lado query). */
export interface FindCustomersPort {
  findAll(params: FindCustomersParams): Promise<FindCustomersResult>;
}
