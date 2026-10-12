import { IndicationOriginNotFoundError } from '@modules/indications/domain/errors/indication.errors';
import type { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';
import { FindIndicationOriginByIdPort } from '../ports/outbound/find-indication-origin-by-id.port';
import { UpdateIndicationOriginIntervalsRepositoryPort } from '../ports/outbound/update-indication-origin-intervals-repository.port';
import { ReopenIndicationOriginUsecase } from './reopen-indication-origin.usecase';

const ORIGIN_ID = '507f1f77bcf86cd799439011';
const FROM = new Date('2025-01-01T00:00:00.000Z');
const CLOSED_TO = new Date('2025-06-01T00:00:00.000Z');

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
  intervals: [{ from: FROM, to: CLOSED_TO }],
});

const makeStubs = (
  snapshot: IndicationOriginSnapshot = endedCanalSnapshot(),
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
  sut: ReopenIndicationOriginUsecase;
};

const makeSut = (snapshot?: IndicationOriginSnapshot): SutTypes => {
  const stubs = makeStubs(snapshot);
  const sut = new ReopenIndicationOriginUsecase(
    stubs.findByIdStub,
    stubs.updateIntervalsStub,
  );
  return { ...stubs, sut };
};

describe('ReopenIndicationOriginUsecase', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeInstanceOf(ReopenIndicationOriginUsecase);
  });

  it('throws when findById misses and does not update intervals', async () => {
    const { sut, findByIdStub, updateIntervalsStub } = makeSut();
    findByIdStub.findById.mockResolvedValue(null);

    await expect(sut.execute({ id: ORIGIN_ID })).rejects.toBeInstanceOf(
      IndicationOriginNotFoundError,
    );
    expect(updateIntervalsStub.updateIntervals).not.toHaveBeenCalled();
  });

  it('appends an open interval and keeps the closed interval to unchanged', async () => {
    jest.useFakeTimers();
    const reopenedAt = new Date('2026-03-10T08:00:00.000Z');
    jest.setSystemTime(reopenedAt);

    const { sut, updateIntervalsStub } = makeSut();

    await expect(sut.execute({ id: ORIGIN_ID })).resolves.toEqual({
      id: ORIGIN_ID,
    });

    expect(updateIntervalsStub.updateIntervals).toHaveBeenCalledWith({
      id: ORIGIN_ID,
      intervals: [
        { from: FROM, to: CLOSED_TO },
        { from: reopenedAt, to: null },
      ],
    });
  });

  it('returns id without write when the origin is already open', async () => {
    const { sut, updateIntervalsStub } = makeSut(openCanalSnapshot());

    await expect(sut.execute({ id: ORIGIN_ID })).resolves.toEqual({
      id: ORIGIN_ID,
    });
    expect(updateIntervalsStub.updateIntervals).not.toHaveBeenCalled();
  });

  it('depends on findById and updateIntervals only', () => {
    const { findByIdStub, updateIntervalsStub } = makeStubs();
    const sut = new ReopenIndicationOriginUsecase(
      findByIdStub,
      updateIntervalsStub,
    );
    expect(sut).toBeInstanceOf(ReopenIndicationOriginUsecase);
  });
});
