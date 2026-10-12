import {
  IndicationOriginCatalogRow,
  ListIndicationOriginsPort,
} from '../ports/outbound/list-indication-origins.port';
import { GetIndicationCatalogQuery } from './get-indication-catalog.query';

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
  sut: GetIndicationCatalogQuery;
  listIndicationOriginsStub: ListIndicationOriginsPort;
};

const makeSut = (rows: IndicationOriginCatalogRow[] = []): SutTypes => {
  const { listIndicationOriginsStub } = makeStubs(rows);
  const sut = new GetIndicationCatalogQuery(listIndicationOriginsStub);

  return { sut, listIndicationOriginsStub };
};

describe('GetIndicationCatalogQuery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetIndicationCatalogQuery);
  });

  it('should return three empty categories when list returns no rows', async () => {
    const { sut } = makeSut([]);

    const result = await sut.execute();

    expect(result.categories).toHaveLength(3);
    expect(result.categories.map((c) => c.id)).toEqual([
      'canal',
      'campanha',
      'amigo',
    ]);
    expect(result.categories.map((c) => c.name)).toEqual([
      'Canal',
      'Campanha',
      'Amigo',
    ]);
    expect(result.categories.map((c) => c.holdsOrigins)).toEqual([
      true,
      true,
      false,
    ]);
    result.categories.forEach((category) => {
      expect(category.origins).toEqual([]);
    });
  });

  it('should call list once', async () => {
    const { sut, listIndicationOriginsStub } = makeSut([]);

    await sut.execute();

    expect(listIndicationOriginsStub.list).toHaveBeenCalledTimes(1);
  });

  it('should nest rows under their category only', async () => {
    const canalRow = makeRow({
      id: ID_AAA,
      categoryId: 'canal',
      name: 'Canal One',
    });
    const { sut } = makeSut([canalRow]);

    const result = await sut.execute();

    const canal = result.categories.find((c) => c.id === 'canal');
    const campanha = result.categories.find((c) => c.id === 'campanha');

    expect(canal?.origins).toHaveLength(1);
    expect(canal?.origins[0]?.name).toBe('Canal One');
    expect(campanha?.origins).toEqual([]);
  });

  it('should expose only id, categoryId, name, active on each origin', async () => {
    const row = makeRow({ id: ID_BBB, categoryId: 'campanha', name: 'Camp X' });
    const { sut } = makeSut([row]);

    const result = await sut.execute();
    const origin = result.categories.find((c) => c.id === 'campanha')
      ?.origins[0];

    expect(origin).toEqual({
      id: ID_BBB,
      categoryId: 'campanha',
      name: 'Camp X',
      active: true,
    });
    expect(origin && 'position' in origin).toBe(false);
    expect(origin && 'intervals' in origin).toBe(false);
    expect(origin && 'nameKey' in origin).toBe(false);
  });

  it('should expose only id, name, holdsOrigins, origins on each category', async () => {
    const { sut } = makeSut([]);

    const result = await sut.execute();

    result.categories.forEach((category) => {
      expect('order' in category).toBe(false);
      expect(Object.keys(category).sort()).toEqual(
        ['holdsOrigins', 'id', 'name', 'origins'].sort(),
      );
    });
  });

  it('should sort origins by position ascending then id ascending', async () => {
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
    const ids = result.categories
      .find((c) => c.id === 'canal')
      ?.origins.map((o) => o.id);

    expect(ids).toEqual([ID_AAA, ID_CCC, ID_BBB]);
  });

  it('should include ended origins with active false', async () => {
    const row = makeRow({ active: false, name: 'Ended' });
    const { sut } = makeSut([row]);

    const result = await sut.execute();
    const origin = result.categories.find((c) => c.id === 'canal')?.origins[0];

    expect(origin?.active).toBe(false);
  });

  it('should ignore rows whose categoryId is amigo', async () => {
    const row = makeRow({
      categoryId: 'canal',
      name: 'Valid',
    });
    const amigoLikeRow = {
      ...makeRow({ name: 'Friend' }),
      categoryId: 'amigo',
    } as unknown as IndicationOriginCatalogRow;
    const { sut } = makeSut([row, amigoLikeRow]);

    const result = await sut.execute();
    const amigo = result.categories.find((c) => c.id === 'amigo');

    expect(amigo?.origins).toEqual([]);
    expect(result.categories).toHaveLength(3);
  });

  it('should nest one canal and one campanha under their own categories', async () => {
    const canal = makeRow({
      id: ID_AAA,
      categoryId: 'canal',
      name: 'C1',
    });
    const campanha = makeRow({
      id: ID_BBB,
      categoryId: 'campanha',
      name: 'K1',
    });
    const { sut } = makeSut([canal, campanha]);

    const result = await sut.execute();

    expect(
      result.categories.find((c) => c.id === 'canal')?.origins[0]?.name,
    ).toBe('C1');
    expect(
      result.categories.find((c) => c.id === 'campanha')?.origins[0]?.name,
    ).toBe('K1');
  });

  it('should depend only on ListIndicationOriginsPort in the constructor', () => {
    const { listIndicationOriginsStub } = makeStubs([]);
    const sut = new GetIndicationCatalogQuery(listIndicationOriginsStub);

    expect(sut).toBeInstanceOf(GetIndicationCatalogQuery);
  });
});
