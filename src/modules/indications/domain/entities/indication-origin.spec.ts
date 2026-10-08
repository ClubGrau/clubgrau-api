import { InvalidNameError, Name } from '@shared/domain/value-object';
import { IndicationOriginNotFoundError } from '../errors/indication.errors';
import type { IndicationOriginInterval } from '../models/indication-origin.model';
import { IndicationOrigin } from './IndicationOrigin';
import type { ReconstituteIndicationOriginProps } from './IndicationOrigin';

const intervalAt = (
  intervals: IndicationOriginInterval[],
  index: number,
): IndicationOriginInterval => {
  const interval = intervals[index];
  if (interval === undefined) {
    throw new Error(`expected an interval at index ${index}`);
  }
  return interval;
};

const HEX_24 = /^[0-9a-f]{24}$/;
const STORED_ID = '507f1f77bcf86cd799439011';

const makeSut = (
  overrides: Partial<{
    categoryId: 'canal' | 'campanha';
    name: string;
    position: number;
  }> = {},
) =>
  IndicationOrigin.create({
    categoryId: 'canal',
    name: 'Instagram',
    position: 1,
    ...overrides,
  });

const makeSnapshot = (
  overrides: Partial<ReconstituteIndicationOriginProps> = {},
): ReconstituteIndicationOriginProps => ({
  id: STORED_ID,
  categoryId: 'campanha',
  name: Name.create('Verão'),
  nameKey: 'verao',
  position: 4,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  intervals: [
    {
      from: new Date('2025-01-01T00:00:00.000Z'),
      to: new Date('2025-06-01T00:00:00.000Z'),
    },
    { from: new Date('2025-07-01T00:00:00.000Z'), to: null },
  ],
  ...overrides,
});

describe('IndicationOrigin', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(makeSut()).toBeInstanceOf(IndicationOrigin);
  });

  describe('create', () => {
    it('opens one interval at createdAt and stores the lowercased name key', () => {
      const now = new Date('2026-03-01T10:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const origin = makeSut();

      expect(origin.id).toMatch(HEX_24);
      expect(origin.active).toBe(true);
      expect(origin.nameKey).toBe('instagram');
      expect(origin.intervals).toEqual([{ from: origin.createdAt, to: null }]);
      expect(intervalAt(origin.intervals, 0).from).toBe(origin.createdAt);
      expect(origin.createdAt).toEqual(now);
      expect(origin.name.value).toBe('Instagram');
    });

    it('rejects a name that Name does not accept', () => {
      expect(() => makeSut({ name: 'A' })).toThrow(InvalidNameError);
    });
  });

  describe('nameKeyFrom', () => {
    it('lowercases with the default case fold and keeps accents distinct', () => {
      expect(IndicationOrigin.nameKeyFrom('Verão')).toBe('verão');
      expect(IndicationOrigin.nameKeyFrom('Verao')).toBe('verao');
      expect(IndicationOrigin.nameKeyFrom('Verão')).not.toBe('verao');
    });

    it('rejects a name that Name does not accept', () => {
      expect(() => IndicationOrigin.nameKeyFrom('I')).toThrow(InvalidNameError);
    });
  });

  describe('correctName', () => {
    it('changes only the name and the name key when the key differs', () => {
      const now = new Date('2026-03-01T10:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const origin = makeSut({ position: 3 });
      const before = {
        categoryId: origin.categoryId,
        position: origin.position,
        createdAt: origin.createdAt,
        intervals: origin.intervals,
      };

      expect(origin.correctName('TikTok')).toBe(true);
      expect(origin.name.value).toBe('TikTok');
      expect(origin.nameKey).toBe('tiktok');
      expect(origin.categoryId).toBe(before.categoryId);
      expect(origin.position).toBe(before.position);
      expect(origin.createdAt).toBe(before.createdAt);
      expect(origin.intervals).toEqual(before.intervals);
    });

    it('keeps the stored display when only the case changes', () => {
      const origin = makeSut();

      expect(origin.correctName('instagram')).toBe(false);
      expect(origin.name.value).toBe('Instagram');
      expect(origin.nameKey).toBe('instagram');
    });

    it('keeps the stored name when spaces were already collapsed', () => {
      const origin = makeSut({ name: 'Google Ads' });
      const before = origin.toJSON();

      expect(origin.correctName('Google  Ads')).toBe(false);
      expect(origin.toJSON()).toEqual(before);
    });
  });

  describe('end', () => {
    it('closes the open interval and leaves from and createdAt unchanged', () => {
      const createdAt = new Date('2026-03-01T10:00:00.000Z');
      const endedAt = new Date('2026-03-02T15:30:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(createdAt);

      const origin = makeSut();
      jest.setSystemTime(endedAt);

      expect(origin.end()).toBe(true);
      const closed = intervalAt(origin.intervals, 0);
      expect(origin.intervals).toHaveLength(1);
      expect(closed.from).toBe(origin.createdAt);
      expect(closed.from).toEqual(createdAt);
      expect(closed.to).toEqual(endedAt);
      expect(origin.createdAt).toEqual(createdAt);
      expect(origin.active).toBe(false);
    });

    it('returns false and keeps the same closing instant when already ended', () => {
      const createdAt = new Date('2026-03-01T10:00:00.000Z');
      const endedAt = new Date('2026-03-02T15:30:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(createdAt);

      const origin = makeSut();
      jest.setSystemTime(endedAt);
      origin.end();

      const closed = origin.intervals;

      jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
      expect(origin.end()).toBe(false);
      expect(origin.intervals).toEqual(closed);
      expect(intervalAt(origin.intervals, 0).to).toBe(intervalAt(closed, 0).to);
    });
  });

  describe('reopen', () => {
    it('appends an open interval and leaves the closed one unchanged', () => {
      const createdAt = new Date('2026-03-01T10:00:00.000Z');
      const endedAt = new Date('2026-03-02T15:30:00.000Z');
      const reopenedAt = new Date('2026-03-10T08:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(createdAt);

      const origin = makeSut();
      jest.setSystemTime(endedAt);
      origin.end();
      const closed = intervalAt(origin.intervals, 0);

      jest.setSystemTime(reopenedAt);
      expect(origin.reopen()).toBe(true);
      expect(origin.intervals).toEqual([
        closed,
        { from: reopenedAt, to: null },
      ]);
      expect(intervalAt(origin.intervals, 0).to).toBe(closed.to);
      expect(origin.active).toBe(true);
      expect(origin.createdAt).toEqual(createdAt);
    });

    it('returns false and adds no interval when the origin is already open', () => {
      const origin = makeSut();
      const open = origin.intervals;

      expect(origin.reopen()).toBe(false);
      expect(origin.intervals).toEqual(open);
    });
  });

  describe('reconstitute', () => {
    it('keeps the stored createdAt, name key, and intervals', () => {
      const snapshot = makeSnapshot();
      const origin = IndicationOrigin.reconstitute(snapshot);

      expect(origin.id).toBe(STORED_ID);
      expect(origin.createdAt).toBe(snapshot.createdAt);
      expect(origin.nameKey).toBe('verao');
      expect(origin.name.value).toBe('Verão');
      expect(origin.nameKey).not.toBe(origin.name.value.toLowerCase());
      expect(origin.intervals).toEqual(snapshot.intervals);
    });

    it('throws a plain Error when intervals are empty', () => {
      const snapshot = makeSnapshot({ intervals: [] });

      expect.assertions(2);
      try {
        IndicationOrigin.reconstitute(snapshot);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(IndicationOriginNotFoundError);
      }
    });
  });

  describe('toJSON', () => {
    it('returns a plain snapshot with the name serialized to a primitive', () => {
      const now = new Date('2026-03-01T10:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const origin = makeSut();
      const snapshot = origin.toJSON();

      expect(snapshot).toEqual({
        id: origin.id,
        categoryId: 'canal',
        name: 'Instagram',
        nameKey: 'instagram',
        position: 1,
        createdAt: origin.createdAt,
        intervals: [{ from: origin.createdAt, to: null }],
      });
      expect(typeof snapshot.name).toBe('string');
      expect(snapshot).not.toHaveProperty('active');
    });
  });
});
