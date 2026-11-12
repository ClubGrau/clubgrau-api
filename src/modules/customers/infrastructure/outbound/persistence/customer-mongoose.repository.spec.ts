import { setupMongoMemoryServer } from '@configs/database/mongoose/test-setup-mongoose-menory';
import { Customer } from '@modules/customers/domain/entities/Customer';
import { CustomerAlreadyExistsError } from '@modules/customers/domain/errors/customer.errors';
import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { Indication } from '@modules/customers/domain/value-objects/indication.vo';
import { Email, Name, Nif, Phone } from '@shared/domain/value-object';
import { makeChainableMock } from '../../../../../configs/database/mongoose/testables';
import { CustomerMongooseRepository } from './customer-mongoose.repository';
import {
  CustomerDocument,
  CustomerMongooseModel,
  CustomerSchema,
} from './customer.schema';
import mongoose from 'mongoose';

const ORIGIN_ID = '507f1f77bcf86cd799439011';
const REFERRER_ID = '507f1f77bcf86cd799439012';

const mockCustomer = {
  _id: new mongoose.Types.ObjectId(),
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '351912345678',
  nif: 123456789,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  rank: 'BRONZE',
} as CustomerDocument;

const mongooseMocks = () => makeChainableMock(mockCustomer);

const makeSut = () => {
  const customerModelMock = mongooseMocks();
  const mongooseDeps = customerModelMock as unknown as CustomerMongooseModel;
  const sut = new CustomerMongooseRepository(mongooseDeps);
  return { sut, customerModelMock };
};

describe('CustomerMongooseRepository', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CustomerMongooseRepository);
  });

  describe('findByEmail', () => {
    it('should findOne customer by email with a valid Mongoose query', async () => {
      const { sut, customerModelMock } = makeSut();

      const customerId = new mongoose.Types.ObjectId().toHexString();
      const email = 'john.doe@example.com';

      const findOneSpy = jest
        .spyOn(customerModelMock, 'findOne')
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce({
            _id: customerId,
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '351912345678',
            nif: 123456789,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            rank: 'BRONZE',
          }),
        });

      const result = await sut.findByEmail(email);
      expect(findOneSpy).toHaveBeenCalledWith({ email });
      expect(result).toEqual({
        id: customerId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '351912345678',
        nif: '123456789',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        indication: null,
        removedAt: null,
      });
    });

    it('should map a stored origin indication back to string ids', async () => {
      const { sut, customerModelMock } = makeSut();
      const customerId = new mongoose.Types.ObjectId().toHexString();
      const originObjectId = new mongoose.Types.ObjectId(ORIGIN_ID);

      jest.spyOn(customerModelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce({
          _id: customerId,
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: null,
          nif: null,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          rank: 'SILVER',
          indication: {
            categoryId: 'campanha',
            originId: originObjectId,
          },
        }),
      });

      const result = await sut.findByEmail('john.doe@example.com');
      expect(result?.rank).toBe('SILVER');
      expect(result?.indication).toEqual({
        categoryId: 'campanha',
        originId: ORIGIN_ID,
      });
    });

    it('should return null if no customer is found', async () => {
      const { sut, customerModelMock } = makeSut();

      const email = 'nonexistent@example.com';

      jest.spyOn(customerModelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await sut.findByEmail(email);
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new customer with a valid Mongoose query', async () => {
      const { sut, customerModelMock } = makeSut();
      const customerData: CustomerModel.toCreate = {
        id: new mongoose.Types.ObjectId().toHexString(),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '33612345678',
        nif: '987654321',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        indication: null,
        removedAt: null,
      };
      const createSpy = jest
        .spyOn(customerModelMock, 'create')
        .mockResolvedValueOnce({
          _id: customerData.id,
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          phone: '33612345678',
          nif: 987654321,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          rank: 'BRONZE',
        });
      const result = await sut.create(customerData);
      expect(createSpy).toHaveBeenCalledWith({
        _id: new mongoose.Types.ObjectId(customerData.id),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '33612345678',
        nif: 987654321,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        removedAt: null,
      });
      expect(createSpy.mock.calls[0]?.[0]).not.toHaveProperty('indication');
      expect(result).toEqual({ id: customerData.id });
    });

    it('should create a customer without optional phone and nif', async () => {
      const { sut, customerModelMock } = makeSut();
      const customerData: CustomerModel.toCreate = {
        id: new mongoose.Types.ObjectId().toHexString(),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: null,
        nif: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        indication: null,
        removedAt: null,
      };
      const createSpy = jest
        .spyOn(customerModelMock, 'create')
        .mockResolvedValueOnce({
          _id: customerData.id,
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          phone: null,
          nif: null,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          rank: 'BRONZE',
        });
      const result = await sut.create(customerData);
      expect(createSpy).toHaveBeenCalledWith({
        _id: new mongoose.Types.ObjectId(customerData.id),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: null,
        nif: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        removedAt: null,
      });
      expect(result).toEqual({ id: customerData.id });
    });

    it('should persist an origin indication with ObjectId originId', async () => {
      const { sut, customerModelMock } = makeSut();
      const customerData: CustomerModel.toCreate = {
        id: new mongoose.Types.ObjectId().toHexString(),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: null,
        nif: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        indication: { categoryId: 'canal', originId: ORIGIN_ID },
        removedAt: null,
      };
      const createSpy = jest
        .spyOn(customerModelMock, 'create')
        .mockResolvedValueOnce({ _id: customerData.id });

      await sut.create(customerData);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          indication: {
            categoryId: 'canal',
            originId: new mongoose.Types.ObjectId(ORIGIN_ID),
          },
        }),
      );
      expect(createSpy.mock.calls[0]?.[0]?.indication).not.toHaveProperty(
        'referrerCustomerId',
      );
    });

    it('should persist a friend indication with ObjectId referrerCustomerId', async () => {
      const { sut, customerModelMock } = makeSut();
      const customerData: CustomerModel.toCreate = {
        id: new mongoose.Types.ObjectId().toHexString(),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: null,
        nif: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        indication: {
          categoryId: 'amigo',
          referrerCustomerId: REFERRER_ID,
        },
        removedAt: null,
      };
      const createSpy = jest
        .spyOn(customerModelMock, 'create')
        .mockResolvedValueOnce({ _id: customerData.id });

      await sut.create(customerData);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          indication: {
            categoryId: 'amigo',
            referrerCustomerId: new mongoose.Types.ObjectId(REFERRER_ID),
          },
        }),
      );
      expect(createSpy.mock.calls[0]?.[0]?.indication).not.toHaveProperty(
        'originId',
      );
    });

    it('should throw CustomerAlreadyExistsError when create rejects with code 11000', async () => {
      const { sut, customerModelMock } = makeSut();
      const customerData: CustomerModel.toCreate = {
        id: new mongoose.Types.ObjectId().toHexString(),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: null,
        nif: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        indication: null,
        removedAt: null,
      };

      jest
        .spyOn(customerModelMock, 'create')
        .mockRejectedValueOnce({ code: 11000 });

      await expect(sut.create(customerData)).rejects.toThrow(
        CustomerAlreadyExistsError,
      );
    });

    it('should propagate other errors from create', async () => {
      const { sut, customerModelMock } = makeSut();
      const customerData: CustomerModel.toCreate = {
        id: new mongoose.Types.ObjectId().toHexString(),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: null,
        nif: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        rank: 'BRONZE',
        indication: null,
        removedAt: null,
      };
      const otherError = new Error('connection failed');

      jest.spyOn(customerModelMock, 'create').mockRejectedValueOnce(otherError);

      await expect(sut.create(customerData)).rejects.toBe(otherError);
    });
  });

  describe('existsReferrableById', () => {
    it('should return true when exists finds a document', async () => {
      const { sut, customerModelMock } = makeSut();
      const id = new mongoose.Types.ObjectId().toHexString();

      const existsSpy = jest
        .spyOn(customerModelMock, 'exists')
        .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(id) });

      await expect(sut.existsReferrableById(id)).resolves.toBe(true);
      expect(existsSpy).toHaveBeenCalledWith({ _id: id, removedAt: null });
    });

    it('should return false when exists returns null', async () => {
      const { sut, customerModelMock } = makeSut();
      const id = new mongoose.Types.ObjectId().toHexString();

      jest.spyOn(customerModelMock, 'exists').mockResolvedValueOnce(null);

      await expect(sut.existsReferrableById(id)).resolves.toBe(false);
    });

    it('should return false when the driver throws on a malformed id', async () => {
      const { sut, customerModelMock } = makeSut();

      jest
        .spyOn(customerModelMock, 'exists')
        .mockRejectedValueOnce(new Error('invalid id'));

      await expect(
        sut.existsReferrableById('not-a-valid-object-id'),
      ).resolves.toBe(false);
    });
  });

  describe('findAll', () => {
    it('should find customers with pagination and return items plus total', async () => {
      const { sut, customerModelMock } = makeSut();
      const customerId = new mongoose.Types.ObjectId().toHexString();
      const lean = jest.fn().mockResolvedValueOnce([
        {
          _id: customerId,
          name: 'Maria Silva',
          email: 'maria.silva@example.com',
          phone: '351912345678',
          nif: 123456789,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          rank: 'BRONZE',
          indication: {
            categoryId: 'canal',
            originId: new mongoose.Types.ObjectId(ORIGIN_ID),
          },
        },
      ]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      const findSpy = jest
        .spyOn(customerModelMock, 'find')
        .mockReturnValueOnce({ sort });
      const countSpy = jest
        .spyOn(customerModelMock, 'countDocuments')
        .mockResolvedValueOnce(45);

      const result = await sut.findAll({ skip: 20, limit: 10 });

      expect(findSpy).toHaveBeenCalledWith({ removedAt: null });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(skip).toHaveBeenCalledWith(20);
      expect(limit).toHaveBeenCalledWith(10);
      expect(countSpy).toHaveBeenCalledWith({ removedAt: null });
      expect(result).toEqual({
        items: [
          {
            id: customerId,
            name: 'Maria Silva',
            email: 'maria.silva@example.com',
            phone: '351912345678',
            nif: '123456789',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            rank: 'BRONZE',
            indication: { categoryId: 'canal', originId: ORIGIN_ID },
          },
        ],
        total: 45,
      });
    });

    it('should apply rank filter when provided', async () => {
      const { sut, customerModelMock } = makeSut();
      const lean = jest.fn().mockResolvedValueOnce([]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      const findSpy = jest
        .spyOn(customerModelMock, 'find')
        .mockReturnValueOnce({ sort });
      const countSpy = jest
        .spyOn(customerModelMock, 'countDocuments')
        .mockResolvedValueOnce(0);

      await sut.findAll({
        rank: 'GOLD',
        skip: 0,
        limit: 20,
      });

      const expectedFilter = { removedAt: null, rank: 'GOLD' };
      expect(findSpy).toHaveBeenCalledWith(expectedFilter);
      expect(countSpy).toHaveBeenCalledWith(expectedFilter);
    });

    it('should apply search across name, email, phone and nif', async () => {
      const { sut, customerModelMock } = makeSut();
      const lean = jest.fn().mockResolvedValueOnce([]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      const findSpy = jest
        .spyOn(customerModelMock, 'find')
        .mockReturnValueOnce({ sort });
      const countSpy = jest
        .spyOn(customerModelMock, 'countDocuments')
        .mockResolvedValueOnce(3);

      await sut.findAll({
        search: 'grau.+(test)',
        rank: 'BRONZE',
        skip: 0,
        limit: 20,
      });

      const expectedFilter = {
        removedAt: null,
        rank: 'BRONZE',
        $or: [
          { name: { $regex: 'grau\\.\\+\\(test\\)', $options: 'i' } },
          { email: { $regex: 'grau\\.\\+\\(test\\)', $options: 'i' } },
          { phone: { $regex: 'grau\\.\\+\\(test\\)', $options: 'i' } },
          {
            $expr: {
              $regexMatch: {
                input: { $toString: { $ifNull: ['$nif', ''] } },
                regex: 'grau\\.\\+\\(test\\)',
                options: 'i',
              },
            },
          },
        ],
      };
      expect(findSpy).toHaveBeenCalledWith(expectedFilter);
      expect(countSpy).toHaveBeenCalledWith(expectedFilter);
    });

    it('should return an empty list when no customers are found', async () => {
      const { sut, customerModelMock } = makeSut();
      const lean = jest.fn().mockResolvedValueOnce([]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      jest.spyOn(customerModelMock, 'find').mockReturnValueOnce({ sort });
      jest.spyOn(customerModelMock, 'countDocuments').mockResolvedValueOnce(0);

      const result = await sut.findAll({ skip: 0, limit: 20 });

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('findNamesByIds', () => {
    it('should return id and name for the matching customers', async () => {
      const { sut, customerModelMock } = makeSut();
      const referrerId = new mongoose.Types.ObjectId(REFERRER_ID);
      const lean = jest
        .fn()
        .mockResolvedValueOnce([
          { _id: referrerId, name: 'João Amigo', removedAt: null },
        ]);
      const select = jest.fn().mockReturnValueOnce({ lean });
      const findSpy = jest
        .spyOn(customerModelMock, 'find')
        .mockReturnValueOnce({ select });

      const result = await sut.findNamesByIds([REFERRER_ID]);

      expect(findSpy).toHaveBeenCalledWith({
        _id: { $in: [referrerId] },
      });
      expect(select).toHaveBeenCalledWith('_id name removedAt');
      expect(result).toEqual([
        { id: REFERRER_ID, name: 'João Amigo', removed: false },
      ]);
    });

    it('should skip the query when every id is malformed', async () => {
      const { sut, customerModelMock } = makeSut();
      const findSpy = jest.spyOn(customerModelMock, 'find');

      const result = await sut.findNamesByIds(['not-an-id']);

      expect(findSpy).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return an empty list when the query finds nothing', async () => {
      const { sut, customerModelMock } = makeSut();
      jest.spyOn(customerModelMock, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce([]),
        }),
      });

      await expect(sut.findNamesByIds([REFERRER_ID])).resolves.toEqual([]);
    });
  });
});

describe('CustomerMongooseRepository (integration)', () => {
  jest.setTimeout(60_000);

  setupMongoMemoryServer();

  let customerModel: CustomerMongooseModel;
  let sut: CustomerMongooseRepository;

  beforeAll(() => {
    customerModel = mongoose.connection.model(
      'CustomerRemoveIntegration',
      CustomerSchema,
    );
    sut = new CustomerMongooseRepository(customerModel);
  });

  const snapshotFromCreate = (
    overrides: {
      email?: string;
      name?: string;
      id?: string;
    } = {},
  ) => {
    const created = Customer.create({
      name: overrides.name ?? 'Persisted Customer',
      email:
        overrides.email ??
        `persisted-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
      phone: '351912345678',
      nif: 123456789,
      indication: {
        categoryId: 'campanha',
        originId: ORIGIN_ID,
      },
    });
    const json = created.toJSON();
    if (overrides.id) {
      return { ...json, id: overrides.id };
    }
    return json;
  };

  const reconstituteAndRemove = (
    stored: CustomerModel.toCreate,
    now: Date,
  ): CustomerModel.toCreate => {
    const indication =
      stored.indication === null
        ? null
        : stored.indication.categoryId === 'amigo'
          ? Indication.reconstitute({
              categoryId: 'amigo',
              referrerCustomerId: stored.indication.referrerCustomerId,
            })
          : Indication.reconstitute({
              categoryId: stored.indication.categoryId,
              originId: stored.indication.originId,
            });

    const entity = Customer.reconstitute({
      id: stored.id,
      name: Name.create(stored.name),
      email: Email.create(stored.email),
      phone: stored.phone ? Phone.create(stored.phone) : null,
      nif: stored.nif ? Nif.create(stored.nif) : null,
      createdAt: stored.createdAt,
      rank: stored.rank,
      indication,
      removedAt: stored.removedAt,
    });
    entity.remove(now);
    return entity.toJSON();
  };

  it('returns the create snapshot from findById with removedAt null', async () => {
    const snapshot = snapshotFromCreate();
    const { id } = await sut.create(snapshot);

    const found = await sut.findById(id);
    expect(found).toEqual({ ...snapshot, id });
    expect(found?.removedAt).toBeNull();
  });

  it('returns null from findById for unknown or malformed ids', async () => {
    const unknownId = new mongoose.Types.ObjectId().toHexString();
    await expect(sut.findById(unknownId)).resolves.toBeNull();
    await expect(sut.findById('not-a-valid-object-id')).resolves.toBeNull();
  });

  it('remove anonymizes PII and keeps identity fields on first call', async () => {
    const snapshot = snapshotFromCreate();
    const { id } = await sut.create(snapshot);
    const stored = (await sut.findById(id))!;
    const removedAt = new Date('2025-06-01T12:00:00.000Z');
    const removedSnapshot = reconstituteAndRemove(stored, removedAt);

    await expect(sut.remove(removedSnapshot)).resolves.toBe(true);

    const document = await customerModel.findById(id).lean();
    expect(document?.email).toBe(removedSnapshot.email);
    expect(document?.phone).toBeNull();
    expect(document?.nif).toBeUndefined();
    expect(document?.removedAt).toEqual(removedAt);
    expect(document?.name).toBe(stored.name);
    expect(document?.rank).toBe(stored.rank);
    expect(String(document?.indication?.originId)).toBe(ORIGIN_ID);
    expect(document?.createdAt).toEqual(stored.createdAt);
  });

  it('returns false on a second remove without changing the document', async () => {
    const snapshot = snapshotFromCreate();
    const { id } = await sut.create(snapshot);
    const stored = (await sut.findById(id))!;
    const firstRemovedAt = new Date('2025-06-01T12:00:00.000Z');
    const removedSnapshot = reconstituteAndRemove(stored, firstRemovedAt);

    await sut.remove(removedSnapshot);
    const afterFirst = await customerModel.findById(id).lean();

    await expect(sut.remove(removedSnapshot)).resolves.toBe(false);
    const afterSecond = await customerModel.findById(id).lean();
    expect(afterSecond).toEqual(afterFirst);
  });

  it('frees the original email for create after remove', async () => {
    const email = `reusable-${new mongoose.Types.ObjectId().toHexString()}@example.com`;
    const snapshot = snapshotFromCreate({ email });
    const { id } = await sut.create(snapshot);
    const stored = (await sut.findById(id))!;
    const removedSnapshot = reconstituteAndRemove(
      stored,
      new Date('2025-06-02T12:00:00.000Z'),
    );

    await sut.remove(removedSnapshot);

    await expect(
      sut.create(snapshotFromCreate({ email, name: 'Another User' })),
    ).resolves.toEqual({ id: expect.any(String) });
  });

  describe('existsReferrableById', () => {
    it('tracks referrability before and after remove', async () => {
      const snapshot = snapshotFromCreate();
      const { id } = await sut.create(snapshot);

      await expect(sut.existsReferrableById(id)).resolves.toBe(true);

      const stored = (await sut.findById(id))!;
      await sut.remove(
        reconstituteAndRemove(stored, new Date('2025-06-03T12:00:00.000Z')),
      );

      await expect(sut.existsReferrableById(id)).resolves.toBe(false);
      await expect(
        sut.existsReferrableById(new mongoose.Types.ObjectId().toHexString()),
      ).resolves.toBe(false);
      await expect(sut.existsReferrableById('bad-id')).resolves.toBe(false);
    });
  });

  it('excludes removed customers from findAll total and search', async () => {
    const active = snapshotFromCreate({
      name: 'Active Listed Customer',
      email: `active-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    });
    const toRemove = snapshotFromCreate({
      name: 'Removed Listed Customer',
      email: `removed-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    });

    await sut.create(active);
    const { id: removedId } = await sut.create(toRemove);
    const storedRemoved = (await sut.findById(removedId))!;
    await sut.remove(
      reconstituteAndRemove(
        storedRemoved,
        new Date('2025-06-04T12:00:00.000Z'),
      ),
    );

    const listed = await sut.findAll({ skip: 0, limit: 20 });
    expect(listed.total).toBe(1);
    expect(listed.items.map((item) => item.id)).toEqual([active.id]);

    const searched = await sut.findAll({
      skip: 0,
      limit: 20,
      search: 'Removed Listed Customer',
    });
    expect(searched.total).toBe(0);
    expect(searched.items).toEqual([]);
  });

  it('flags removed rows in findNamesByIds without filtering them', async () => {
    const activeId = new mongoose.Types.ObjectId().toHexString();
    const removedId = new mongoose.Types.ObjectId().toHexString();

    await sut.create(
      snapshotFromCreate({
        id: activeId,
        name: 'Active Referrer',
        email: `active-ref-${activeId}@example.com`,
      }),
    );
    await sut.create(
      snapshotFromCreate({
        id: removedId,
        name: 'Removed Referrer',
        email: `removed-ref-${removedId}@example.com`,
      }),
    );
    const storedRemoved = (await sut.findById(removedId))!;
    await sut.remove(
      reconstituteAndRemove(
        storedRemoved,
        new Date('2025-06-05T12:00:00.000Z'),
      ),
    );

    const names = await sut.findNamesByIds([activeId, removedId]);
    expect(names).toEqual(
      expect.arrayContaining([
        { id: activeId, name: 'Active Referrer', removed: false },
        { id: removedId, name: 'Removed Referrer', removed: true },
      ]),
    );
  });
});
