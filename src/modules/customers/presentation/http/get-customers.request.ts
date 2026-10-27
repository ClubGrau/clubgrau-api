import { PaginationInputDto } from '@shared/application/pagination/pagination.dto';

/**
 * Request HTTP da listagem de customers (query string bruta).
 * rank chega como string via adaptRoute; a normalização tipada
 * para GetCustomersDto acontece no controller.
 */
export type GetCustomersRequest = PaginationInputDto & {
  rank?: string;
  search?: string;
};
