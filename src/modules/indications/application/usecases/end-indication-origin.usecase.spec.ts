import { IndicationOriginNotFoundError } from '@modules/indications/domain/errors/indication.errors';
import type { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';
import { FindIndicationOriginByIdPort } from '../ports/outbound/find-indication-origin-by-id.port';
import { UpdateIndicationOriginIntervalsRepositoryPort } from '../ports/outbound/update-indication-origin-intervals-repository.port';
import { EndIndicationOriginUsecase } from './end-indication-origin.usecase';

const ORIGIN_ID = '507f1f77bcf86cd799439011';
const FROM = new Date('2025-01-01T00:00:00.000Z');

const openCanalSnapshot = (): IndicationOriginSnapshot => ({
  id: ORIGIN_ID,
  categoryId: 'canal',
  name: 'Instagram',
  nameKey: 'instagram',
  position: 1,
  createdAt: FROM,
  intervals: [{ from: FROM, to: null }],
});

const endedCanalSnapshot = (): IndicationOriginSnapshot => ({
  ...openCanalSnapshot(),
  intervals: [{ from: FROM, to: new Date('2025-06-01T00:00:00.000Z') }],
});

const makeStubs = (
  snapshot: IndicationOriginSnapshot = openCanalSnapshot(),
) => {
  const findByIdStub = {
    findById: jest.fn().mockResolvedValue(snapshot),
  } satisfies FindIndicationOriginByIdPort;

  const updateIntervalsStub = {
    updateIntervals: jest.fn().mockResolvedValue(undefined),
  } satisfies UpdateIndicationOriginIntervalsRepositoryPort;

  return { findByIdStub, updateIntervalsStub };
};

type SutTypes = ReturnType<typeof makeStubs> & {
  sut: EndIndicationOriginUsecase;
};

const makeSut = (snapshot?: IndicationOriginSnapshot): SutTypes => {
  const stubs = makeStubs(snapshot);
  const sut = new EndIndicationOriginUsecase(
    stubs.findByIdStub,
    stubs.updateIntervalsStub,
  );
  return { ...stubs, sut };
};

describe('EndIndicationOriginUsecase', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeInstanceOf(EndIndicationOriginUsecase);
  });

  it('throws when findById misses and does not update intervals', async () => {
    const { sut, findByIdStub, updateIntervalsStub } = makeSut();
    findByIdStub.findById.mockResolvedValue(null);

    await expect(sut.execute({ id: ORIGIN_ID })).rejects.toBeInstanceOf(
      IndicationOriginNotFoundError,
    );
    expect(updateIntervalsStub.updateIntervals).not.toHaveBeenCalled();
  });

  it('closes the open interval at now and keeps from unchanged', async () => {
    jest.useFakeTimers();
    const endedAt = new Date('2026-03-02T15:30:00.000Z');
    jest.setSystemTime(endedAt);

    const { sut, updateIntervalsStub } = makeSut();

    await expect(sut.execute({ id: ORIGIN_ID })).resolves.toEqual({
      id: ORIGIN_ID,
    });

    expect(updateIntervalsStub.updateIntervals).toHaveBeenCalledWith({
      id: ORIGIN_ID,
      intervals: [{ from: FROM, to: endedAt }],
    });
  });

  it('returns id without write when the origin is already ended', async () => {
    const { sut, updateIntervalsStub } = makeSut(endedCanalSnapshot());

    await expect(sut.execute({ id: ORIGIN_ID })).resolves.toEqual({
      id: ORIGIN_ID,
    });
    expect(updateIntervalsStub.updateIntervals).not.toHaveBeenCalled();
  });

  it('patch carries only id and intervals', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-02T15:30:00.000Z'));

    const { sut, updateIntervalsStub } = makeSut();

    await sut.execute({ id: ORIGIN_ID });

    const payload = updateIntervalsStub.updateIntervals.mock.calls[0]?.[0];
    expect(Object.keys(payload ?? {})).toEqual(['id', 'intervals']);
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('nameKey');
    expect(payload).not.toHaveProperty('position');
    expect(payload).not.toHaveProperty('categoryId');
  });

  it('depends on findById and updateIntervals only', () => {
    const { findByIdStub, updateIntervalsStub } = makeStubs();
    const sut = new EndIndicationOriginUsecase(
      findByIdStub,
      updateIntervalsStub,
    );
    expect(sut).toBeInstanceOf(EndIndicationOriginUsecase);
  });
});
