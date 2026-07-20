import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  normalizePagination,
  toPaginatedResult,
} from './pagination.dto';

describe('normalizePagination', () => {
  it('should use defaults when input is empty', () => {
    expect(normalizePagination({})).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it('should use defaults when input is omitted', () => {
    expect(normalizePagination()).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it('should normalize valid page and limit', () => {
    expect(normalizePagination({ page: 3, limit: 10 })).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
    });
  });

  it('should coerce string query params', () => {
    expect(normalizePagination({ page: '2', limit: '15' })).toEqual({
      page: 2,
      limit: 15,
      skip: 15,
    });
  });

  it('should floor decimal values', () => {
    expect(normalizePagination({ page: 2.9, limit: 10.8 })).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
    });
  });

  it('should fallback to defaults for invalid values', () => {
    expect(normalizePagination({ page: 'abc', limit: -5 })).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it('should fallback when page or limit is less than 1', () => {
    expect(normalizePagination({ page: 0, limit: 0 })).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it('should cap limit at MAX_LIMIT', () => {
    expect(normalizePagination({ page: 1, limit: 999 })).toEqual({
      page: 1,
      limit: MAX_LIMIT,
      skip: 0,
    });
  });
});

describe('toPaginatedResult', () => {
  it('should build a paginated envelope', () => {
    const items = [{ id: '1' }, { id: '2' }];

    expect(toPaginatedResult(items, 45, { page: 2, limit: 20 })).toEqual({
      items,
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it('should return totalPages 0 when total is 0', () => {
    expect(toPaginatedResult([], 0, { page: 1, limit: 20 })).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });
});
