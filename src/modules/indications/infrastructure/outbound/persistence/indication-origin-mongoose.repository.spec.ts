import { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';
import {
  IndicationOriginNameTakenError,
  IndicationOriginNotFoundError,
} from '@modules/indications/domain/errors/indication.errors';
import { makeChainableMock } from '@configs/database/mongoose/testables';
import mongoose from 'mongoose';
import { IndicationOriginMongooseRepository } from './indication-origin-mongoose.repository';
import {
  IndicationOriginDocument,
  IndicationOriginMongooseModel,
  IndicationOriginSchema,
} from './indication-origin.schema';

const originId = new mongoose.Types.ObjectId().toHexString();
const createdAt = new Date('2024-06-01T12:00:00Z');

const sampleSnapshot: IndicationOriginSnapshot = {
  id: originId,
  categoryId: 'canal',
  name: 'Instagram',
  nameKey: 'instagram',
  position: 1,
  createdAt,
  intervals: [{ from: createdAt, to: null }],
};

const sampleDocument = {
  _id: new mongoose.Types.ObjectId(originId),
  categoryId: 'canal' as const,
  name: 'Instagram',
  nameKey: 'instagram',
  position: 1,
  createdAt,
  intervals: [{ from: createdAt, to: null }],
} as IndicationOriginDocument;

const makeSut = () => {
  const modelMock = makeChainableMock(null);
  const model = modelMock as unknown as IndicationOriginMongooseModel;
  const sut = new IndicationOriginMongooseRepository(model);
  return { sut, modelMock };
};

describe('IndicationOriginMongooseRepository', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(IndicationOriginMongooseRepository);
  });

  describe('schema', () => {
    it('uses collection origins', () => {
      expect(IndicationOriginSchema.get('collection')).toBe('origins');
    });

    it('has unique index on categoryId and nameKey only', () => {
      const indexes = IndicationOriginSchema.indexes();
      const hasCompoundUnique = indexes.some(
        ([keys, opts]) =>
          opts?.unique === true &&
          keys.categoryId === 1 &&
          keys.nameKey === 1 &&
          Object.keys(keys).length === 2,
      );
      expect(hasCompoundUnique).toBe(true);

      const hasUniquePosition = indexes.some(
        ([keys, opts]) => opts?.unique === true && 'position' in keys,
      );
      expect(hasUniquePosition).toBe(false);
    });

    it('restricts categoryId enum to canal and campanha', () => {
      const categoryIdPath = IndicationOriginSchema.path('categoryId');
      expect(categoryIdPath?.options.enum).toEqual(['canal', 'campanha']);
    });
  });

  describe('insert', () => {
    it('creates a document from the snapshot and returns its id', async () => {
      const { sut, modelMock } = makeSut();
      const createSpy = jest
        .spyOn(modelMock, 'create')
        .mockResolvedValueOnce(sampleDocument);

      const result = await sut.insert(sampleSnapshot);

      expect(createSpy).toHaveBeenCalledWith({
        _id: new mongoose.Types.ObjectId(originId),
        categoryId: 'canal',
        name: 'Instagram',
        nameKey: 'instagram',
        position: 1,
        createdAt,
        intervals: [{ from: createdAt, to: null }],
      });
      expect(result).toEqual({ id: originId });
    });

    it('rejects IndicationOriginNameTakenError on duplicate key', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'create').mockRejectedValueOnce({ code: 11000 });

      await expect(sut.insert(sampleSnapshot)).rejects.toBeInstanceOf(
        IndicationOriginNameTakenError,
      );
    });

    it('propagates other errors without mapping to name taken', async () => {
      const { sut, modelMock } = makeSut();
      const otherError = new Error('connection failed');
      jest.spyOn(modelMock, 'create').mockRejectedValueOnce(otherError);

      await expect(sut.insert(sampleSnapshot)).rejects.toBe(otherError);
    });
  });

  describe('updateName', () => {
    it('updates name and nameKey only', async () => {
      const { sut, modelMock } = makeSut();
      const updateSpy = jest
        .spyOn(modelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateName({
        id: originId,
        name: 'New Name',
        nameKey: 'new-name',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        { _id: originId },
        { $set: { name: 'New Name', nameKey: 'new-name' } },
      );
    });

    it('rejects IndicationOriginNameTakenError on duplicate key', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'updateOne').mockRejectedValueOnce({ code: 11000 });

      await expect(
        sut.updateName({ id: originId, name: 'X', nameKey: 'x' }),
      ).rejects.toBeInstanceOf(IndicationOriginNameTakenError);
    });

    it('throws a generic Error when no document matches', async () => {
      const { sut, modelMock } = makeSut();
      jest
        .spyOn(modelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });

      const promise = sut.updateName({ id: originId, name: 'X', nameKey: 'x' });
      await expect(promise).rejects.toThrow(Error);
      await expect(promise).rejects.not.toBeInstanceOf(
        IndicationOriginNotFoundError,
      );
    });

    it('resolves when matched but not modified', async () => {
      const { sut, modelMock } = makeSut();
      jest
        .spyOn(modelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 0 });

      await expect(
        sut.updateName({ id: originId, name: 'X', nameKey: 'x' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('updateIntervals', () => {
    const intervals = [
      { from: createdAt, to: new Date('2024-07-01T00:00:00Z') },
      { from: new Date('2024-08-01T00:00:00Z'), to: null },
    ];

    it('updates intervals only', async () => {
      const { sut, modelMock } = makeSut();
      const updateSpy = jest
        .spyOn(modelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateIntervals({ id: originId, intervals });

      expect(updateSpy).toHaveBeenCalledWith(
        { _id: originId },
        { $set: { intervals } },
      );
    });

    it('throws a generic Error when no document matches', async () => {
      const { sut, modelMock } = makeSut();
      jest
        .spyOn(modelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });

      const promise = sut.updateIntervals({ id: originId, intervals });
      await expect(promise).rejects.toThrow(Error);
      await expect(promise).rejects.not.toBeInstanceOf(
        IndicationOriginNotFoundError,
      );
    });
  });

  describe('existsByNameKey', () => {
    it('queries by categoryId and nameKey without interval filter', async () => {
      const { sut, modelMock } = makeSut();
      const findOneSpy = jest.spyOn(modelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      } as ReturnType<typeof modelMock.findOne>);

      await sut.existsByNameKey({ categoryId: 'canal', nameKey: 'instagram' });

      expect(findOneSpy).toHaveBeenCalledWith({
        categoryId: 'canal',
        nameKey: 'instagram',
      });
    });

    it('excludes exceptOriginId when provided', async () => {
      const { sut, modelMock } = makeSut();
      const exceptOriginId = new mongoose.Types.ObjectId().toHexString();
      const findOneSpy = jest.spyOn(modelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(sampleDocument),
      } as ReturnType<typeof modelMock.findOne>);

      await sut.existsByNameKey({
        categoryId: 'campanha',
        nameKey: 'summer',
        exceptOriginId,
      });

      expect(findOneSpy).toHaveBeenCalledWith({
        categoryId: 'campanha',
        nameKey: 'summer',
        _id: { $ne: exceptOriginId },
      });
    });

    it('returns true on hit and false on miss', async () => {
      const { sut, modelMock } = makeSut();

      jest.spyOn(modelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(sampleDocument),
      } as ReturnType<typeof modelMock.findOne>);
      await expect(
        sut.existsByNameKey({ categoryId: 'canal', nameKey: 'instagram' }),
      ).resolves.toBe(true);

      jest.spyOn(modelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      } as ReturnType<typeof modelMock.findOne>);
      await expect(
        sut.existsByNameKey({ categoryId: 'canal', nameKey: 'missing' }),
      ).resolves.toBe(false);
    });
  });

  describe('nextPosition', () => {
    it('returns 1 when category has no origins', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'findOne').mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValueOnce(null),
      } as ReturnType<typeof modelMock.findOne>);

      await expect(sut.nextPosition('canal')).resolves.toBe(1);
    });

    it('returns max position plus 1', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'findOne').mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValueOnce({ position: 4 }),
      } as ReturnType<typeof modelMock.findOne>);

      await expect(sut.nextPosition('campanha')).resolves.toBe(5);
    });
  });

  describe('findById', () => {
    it('returns snapshot with intervals and nameKey', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'findById').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(sampleDocument),
      } as ReturnType<typeof modelMock.findById>);

      const result = await sut.findById(originId);

      expect(result).toEqual({
        id: originId,
        categoryId: 'canal',
        name: 'Instagram',
        nameKey: 'instagram',
        position: 1,
        createdAt,
        intervals: [{ from: createdAt, to: null }],
      });
    });

    it('returns null on miss', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'findById').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      } as ReturnType<typeof modelMock.findById>);

      await expect(sut.findById(originId)).resolves.toBeNull();
    });

    it('returns null on invalid id cast error', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'findById').mockReturnValueOnce({
        lean: jest
          .fn()
          .mockRejectedValueOnce(new Error('Cast to ObjectId failed')),
      } as ReturnType<typeof modelMock.findById>);

      await expect(sut.findById('not-an-id')).resolves.toBeNull();
    });
  });

  describe('list', () => {
    it('maps open last interval to active true without intervals or nameKey', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'find').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([sampleDocument]),
      } as ReturnType<typeof modelMock.find>);

      const rows = await sut.list();

      expect(rows).toEqual([
        {
          id: originId,
          categoryId: 'canal',
          name: 'Instagram',
          position: 1,
          active: true,
        },
      ]);
      expect(rows[0]).not.toHaveProperty('intervals');
      expect(rows[0]).not.toHaveProperty('nameKey');
    });

    it('maps closed last interval to active false', async () => {
      const { sut, modelMock } = makeSut();
      const closedDoc = {
        ...sampleDocument,
        intervals: [{ from: createdAt, to: new Date('2024-07-01T00:00:00Z') }],
      };
      jest.spyOn(modelMock, 'find').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([closedDoc]),
      } as ReturnType<typeof modelMock.find>);

      const rows = await sut.list();
      expect(rows[0]?.active).toBe(false);
    });

    it('derives active from the last interval only', async () => {
      const { sut, modelMock } = makeSut();
      const doc = {
        ...sampleDocument,
        intervals: [
          { from: createdAt, to: null },
          {
            from: new Date('2024-08-01T00:00:00Z'),
            to: new Date('2024-09-01T00:00:00Z'),
          },
        ],
      };
      jest.spyOn(modelMock, 'find').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([doc]),
      } as ReturnType<typeof modelMock.find>);

      const rows = await sut.list();
      expect(rows[0]?.active).toBe(false);
    });

    it('includes ended origins in the result', async () => {
      const { sut, modelMock } = makeSut();
      const ended = {
        ...sampleDocument,
        _id: new mongoose.Types.ObjectId(),
        name: 'Old',
        intervals: [{ from: createdAt, to: new Date('2024-07-01T00:00:00Z') }],
      };
      jest.spyOn(modelMock, 'find').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([ended]),
      } as ReturnType<typeof modelMock.find>);

      const rows = await sut.list();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.active).toBe(false);
    });
  });

  describe('findOriginNamesByIds', () => {
    it('returns id and name for the matching origins', async () => {
      const { sut, modelMock } = makeSut();
      const lean = jest
        .fn()
        .mockResolvedValueOnce([
          { _id: sampleDocument._id, name: 'Instagram' },
        ]);
      const select = jest.fn().mockReturnValueOnce({ lean });
      const findSpy = jest
        .spyOn(modelMock, 'find')
        .mockReturnValueOnce({ select } as ReturnType<typeof modelMock.find>);

      const result = await sut.findOriginNamesByIds([originId]);

      expect(findSpy).toHaveBeenCalledWith({
        _id: { $in: [sampleDocument._id] },
      });
      expect(select).toHaveBeenCalledWith('_id name');
      expect(result).toEqual([{ id: originId, name: 'Instagram' }]);
    });

    it('skips the query when every id is malformed', async () => {
      const { sut, modelMock } = makeSut();
      const findSpy = jest.spyOn(modelMock, 'find');

      const result = await sut.findOriginNamesByIds(['not-an-id']);

      expect(findSpy).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('returns an empty list when the query finds nothing', async () => {
      const { sut, modelMock } = makeSut();
      jest.spyOn(modelMock, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce([]),
        }),
      } as ReturnType<typeof modelMock.find>);

      await expect(sut.findOriginNamesByIds([originId])).resolves.toEqual([]);
    });
  });
});
