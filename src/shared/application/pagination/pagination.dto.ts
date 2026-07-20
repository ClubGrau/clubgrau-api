/** Input de paginação offset (page é 1-based). Aceita string por causa de query params HTTP. */
export interface PaginationInputDto {
  page?: number | string;
  limit?: number | string;
}

/** Envelope genérico de resultado paginado. */
export interface PaginatedResultDto<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Paginação já normalizada para uso em queries / repositórios. */
export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

function toPositiveInt(
  value: number | string | undefined,
  fallback: number,
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

/** Normaliza page/limit e calcula skip. */
export function normalizePagination(
  input: PaginationInputDto = {},
): NormalizedPagination {
  const page = Math.max(1, toPositiveInt(input.page, DEFAULT_PAGE));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, toPositiveInt(input.limit, DEFAULT_LIMIT)),
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/** Monta o envelope paginado a partir de items + total. */
export function toPaginatedResult<T>(
  items: T[],
  total: number,
  pagination: Pick<NormalizedPagination, 'page' | 'limit'>,
): PaginatedResultDto<T> {
  const { page, limit } = pagination;

  return {
    items,
    page,
    limit,
    total,
    totalPages: limit === 0 ? 0 : Math.ceil(total / limit),
  };
}
