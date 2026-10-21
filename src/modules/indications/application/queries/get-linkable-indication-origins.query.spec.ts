import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  IndicationOriginCatalogRow,
  ListIndicationOriginsPort,
} from '../ports/outbound/list-indication-origins.port';
import { GetLinkableIndicationOriginsQuery } from './get-linkable-indication-origins.query';

const ID_AAA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ID_BBB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ID_CCC = 'cccccccccccccccccccccccc';

const makeRow = (
  overrides: Partial<IndicationOriginCatalogRow> = {},
): IndicationOriginCatalogRow => ({
  id: ID_AAA,
  categoryId: 'canal',
  name: 'Origin A',
  position: 1,
  active: true,
  ...overrides,
});

const makeStubs = (rows: IndicationOriginCatalogRow[] = []) => {
  const listIndicationOriginsStub: ListIndicationOriginsPort = {
    list: jest.fn().mockResolvedValue(rows),
  };

  return { listIndicationOriginsStub };
};

type SutTypes = {
  sut: GetLinkableIndicationOriginsQuery;
  listIndicationOriginsStub: ListIndicationOriginsPort;
};

const makeSut = (rows: IndicationOriginCatalogRow[] = []): SutTypes => {
  const { listIndicationOriginsStub } = makeStubs(rows);
  const sut = new GetLinkableIndicationOriginsQuery(listIndicationOriginsStub);

  return { sut, listIndicationOriginsStub };
};

describe('GetLinkableIndicationOriginsQuery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetLinkableIndicationOriginsQuery);
  });

  it('should return only id, categoryId and name for active canal and campanha rows', async () => {
    const canal = makeRow({
      id: ID_AAA,
      categoryId: 'canal',
      name: 'Instagram',
      position: 2,
      active: true,
    });
    const campanha = makeRow({
      id: ID_BBB,
      categoryId: 'campanha',
      name: 'Verão',
      position: 1,
      active: true,
    });
    const { sut } = makeSut([campanha, canal]);

    const result = await sut.execute();

    expect(result.origins).toEqual([
      { id: ID_AAA, categoryId: 'canal', name: 'Instagram' },
      { id: ID_BBB, categoryId: 'campanha', name: 'Verão' },
    ]);
    result.origins.forEach((origin) => {
      expect(origin).not.toHaveProperty('active');
      expect(origin).not.toHaveProperty('position');
      expect(Object.keys(origin).sort()).toEqual(
        ['categoryId', 'id', 'name'].sort(),
      );
    });
  });

  it('should drop rows with active false', async () => {
    const active = makeRow({
      id: ID_AAA,
      categoryId: 'canal',
      name: 'Instagram',
      active: true,
    });
    const inactive = makeRow({
      id: ID_BBB,
      categoryId: 'campanha',
      name: 'Encerrada',
      active: false,
    });
    const { sut } = makeSut([inactive, active]);

    const result = await sut.execute();

    expect(result.origins).toEqual([
      { id: ID_AAA, categoryId: 'canal', name: 'Instagram' },
    ]);
  });

  it('should place every canal before campanha even when campanha has a smaller position', async () => {
    const campanha = makeRow({
      id: ID_CCC,
      categoryId: 'campanha',
      name: 'Verão',
      position: 0,
    });
    const canal = makeRow({
      id: ID_AAA,
      categoryId: 'canal',
      name: 'Instagram',
      position: 9,
    });
    const { sut } = makeSut([campanha, canal]);

    const result = await sut.execute();

    expect(result.origins.map((origin) => origin.categoryId)).toEqual([
      'canal',
      'campanha',
    ]);
    expect(result.origins.map((origin) => origin.id)).toEqual([ID_AAA, ID_CCC]);
  });

  it('should sort canal rows by position then id', async () => {
    const rows = [
      makeRow({
        id: ID_BBB,
        categoryId: 'canal',
        name: 'Pos 2',
        position: 2,
      }),
      makeRow({
        id: ID_CCC,
        categoryId: 'canal',
        name: 'Pos 1 C',
        position: 1,
      }),
      makeRow({
        id: ID_AAA,
        categoryId: 'canal',
        name: 'Pos 1 A',
        position: 1,
      }),
    ];
    const { sut } = makeSut(rows);

    const result = await sut.execute();

    expect(result.origins.map((origin) => origin.id)).toEqual([
      ID_AAA,
      ID_CCC,
      ID_BBB,
    ]);
  });

  it('should return an empty list when list resolves no rows', async () => {
    const { sut, listIndicationOriginsStub } = makeSut([]);

    const result = await sut.execute();

    expect(listIndicationOriginsStub.list).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ origins: [] });
  });

  it('should return an empty list when every row is inactive', async () => {
    const { sut } = makeSut([
      makeRow({ active: false, categoryId: 'canal' }),
      makeRow({
        id: ID_BBB,
        active: false,
        categoryId: 'campanha',
      }),
    ]);

    const result = await sut.execute();

    expect(result).toEqual({ origins: [] });
  });

  it('should not import IndicationCategories', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/indications/application/queries/get-linkable-indication-origins.query.ts',
      ),
      'utf8',
    );

    expect(source).not.toMatch(/IndicationCategories/);
  });
});
