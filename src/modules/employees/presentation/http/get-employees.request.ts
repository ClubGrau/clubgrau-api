import { PaginationInputDto } from '@shared/application/pagination/pagination.dto';

/**
 * Request HTTP da listagem de employees (query string bruta).
 * status/role chegam como string via adaptRoute; a normalização tipada
 * para GetEmployeesDto acontece no controller.
 */
export type GetEmployeesRequest = PaginationInputDto & {
  status?: string;
  role?: string;
  search?: string;
};
