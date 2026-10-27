import { CustomerAlreadyExistsError } from '@modules/customers/domain/errors/customer.errors';
import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { makeChainableMock } from '../../../../../configs/database/mongoose/testables';
import { CustomerMongooseRepository } from './customer-mongoose.repository';
import { CustomerDocument, CustomerMongooseModel } from './customer.schema';
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
      };
      const otherError = new Error('connection failed');

      jest.spyOn(customerModelMock, 'create').mockRejectedValueOnce(otherError);

      await expect(sut.create(customerData)).rejects.toBe(otherError);
    });
  });

  describe('existsById', () => {
    it('should return true when exists finds a document', async () => {
      const { sut, customerModelMock } = makeSut();
      const id = new mongoose.Types.ObjectId().toHexString();

      const existsSpy = jest
        .spyOn(customerModelMock, 'exists')
        .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(id) });

      await expect(sut.existsById(id)).resolves.toBe(true);
      expect(existsSpy).toHaveBeenCalledWith({ _id: id });
    });

    it('should return false when exists returns null', async () => {
      const { sut, customerModelMock } = makeSut();
      const id = new mongoose.Types.ObjectId().toHexString();

      jest.spyOn(customerModelMock, 'exists').mockResolvedValueOnce(null);

      await expect(sut.existsById(id)).resolves.toBe(false);
    });

    it('should return false when the driver throws on a malformed id', async () => {
      const { sut, customerModelMock } = makeSut();

      jest
        .spyOn(customerModelMock, 'exists')
        .mockRejectedValueOnce(new Error('invalid id'));

      await expect(sut.existsById('not-a-valid-object-id')).resolves.toBe(
        false,
      );
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

      expect(findSpy).toHaveBeenCalledWith({});
      expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(skip).toHaveBeenCalledWith(20);
      expect(limit).toHaveBeenCalledWith(10);
      expect(countSpy).toHaveBeenCalledWith({});
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

      const expectedFilter = { rank: 'GOLD' };
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
        .mockResolvedValueOnce([{ _id: referrerId, name: 'João Amigo' }]);
      const select = jest.fn().mockReturnValueOnce({ lean });
      const findSpy = jest
        .spyOn(customerModelMock, 'find')
        .mockReturnValueOnce({ select });

      const result = await sut.findNamesByIds([REFERRER_ID]);

      expect(findSpy).toHaveBeenCalledWith({
        _id: { $in: [referrerId] },
      });
      expect(select).toHaveBeenCalledWith('_id name');
      expect(result).toEqual([{ id: REFERRER_ID, name: 'João Amigo' }]);
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
