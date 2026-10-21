import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IndicationOriginSnapshotMapper } from '@modules/indications/application/mappers/indication-origin-snapshot.mapper';
import { FindIndicationOriginByIdPort } from '@modules/indications/application/ports/outbound/find-indication-origin-by-id.port';
import type { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';
import { IndicationOriginLookupAdapter } from './indication-origin-lookup.adapter';

const ORIGIN_ID = '507f1f77bcf86cd799439011';
const FROM = new Date('2025-01-01T00:00:00.000Z');

const openSnapshot = (): IndicationOriginSnapshot => ({
  id: ORIGIN_ID,
  categoryId: 'canal',
  name: 'Instagram',
  nameKey: 'instagram',
  position: 1,
  createdAt: FROM,
  intervals: [{ from: FROM, to: null }],
});

const endedSnapshot = (): IndicationOriginSnapshot => ({
  ...openSnapshot(),
  intervals: [{ from: FROM, to: new Date('2025-06-01T00:00:00.000Z') }],
});

const makeSut = (snapshot: IndicationOriginSnapshot | null) => {
  const findByIdStub = {
    findById: jest.fn().mockResolvedValue(snapshot),
  } satisfies FindIndicationOriginByIdPort;

  const sut = new IndicationOriginLookupAdapter(findByIdStub);

  return { sut, findByIdStub };
};

describe('IndicationOriginLookupAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return null and skip reconstitution when findById returns null', async () => {
    const { sut, findByIdStub } = makeSut(null);
    const toEntitySpy = jest.spyOn(IndicationOriginSnapshotMapper, 'toEntity');

    const result = await sut.findOrigin('not-a-hex-id');

    expect(findByIdStub.findById).toHaveBeenCalledWith('not-a-hex-id');
    expect(toEntitySpy).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should return facts from the entity when the last interval is open', async () => {
    const snapshot = openSnapshot();
    const { sut } = makeSut(snapshot);
    const entity = IndicationOriginSnapshotMapper.toEntity(snapshot);

    const result = await sut.findOrigin(ORIGIN_ID);

    expect(entity.active).toBe(true);
    expect(result).toEqual({
      id: entity.id,
      categoryId: entity.categoryId,
      active: entity.active,
    });
  });

  it('should return facts from the entity when the last interval is closed', async () => {
    const snapshot = endedSnapshot();
    const { sut } = makeSut(snapshot);
    const entity = IndicationOriginSnapshotMapper.toEntity(snapshot);

    const result = await sut.findOrigin(ORIGIN_ID);

    expect(entity.active).toBe(false);
    expect(result).toEqual({
      id: entity.id,
      categoryId: entity.categoryId,
      active: entity.active,
    });
  });

  it('should not import the customers domain', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/indications/infrastructure/outbound/indication-origin-lookup.adapter.ts',
      ),
      'utf8',
    );

    expect(source).not.toContain('@modules/customers/domain');
  });
});
