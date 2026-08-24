import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { makeChainableMock } from '../../../../../configs/database/mongoose/testables';
import { EmployeeMongooseRepository } from './employee-mongoose.repository';
import { EmployeeDocument, EmployeeMongooseModel } from './employee.schema';
import mongoose from 'mongoose';

const employeeStatuses = {
  REMOVED: EmployeeModel.Status.REMOVED,
  ACTIVE: EmployeeModel.Status.ACTIVE,
  INACTIVE: EmployeeModel.Status.INACTIVE,
  ADMIN: EmployeeModel.Role.ADMIN,
};

const mockEmployee = {
  _id: new mongoose.Types.ObjectId(),
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: EmployeeModel.Role.ADMIN,
  password: 'hashed_password',
  phone: '351912345678',
  nif: 123456789,
  status: EmployeeModel.Status.ACTIVE,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  deactivateAt: null,
  removedAt: null,
} as EmployeeDocument;

const mongooseMocks = () => makeChainableMock(mockEmployee);

const makeSut = () => {
  const employeeModelMock = mongooseMocks();
  const mongooseDeps = employeeModelMock as unknown as EmployeeMongooseModel;
  const sut = new EmployeeMongooseRepository(mongooseDeps);
  return { sut, employeeModelMock };
};

describe('EmployeeMongooseRepository', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(EmployeeMongooseRepository);
  });

  describe('findByEmail', () => {
    it('should findOne employee by email with a valid Mongoose query', async () => {
      const { sut, employeeModelMock } = makeSut();

      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const email = 'john.doe@example.com';

      const findOneSpy = jest
        .spyOn(employeeModelMock, 'findOne')
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce({
            _id: employeeId,
            name: 'John Doe',
            email: 'john.doe@example.com',
            password: 'hashed_password',
            role: EmployeeModel.Role.ADMIN,
            phone: '351912345678',
            nif: 123456789,
            status: EmployeeModel.Status.ACTIVE,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            deactivateAt: null,
            removedAt: null,
          }),
        });

      const result = await sut.findByEmail(email);
      expect(findOneSpy).toHaveBeenCalledWith({ email });
      expect(result).toEqual({
        id: employeeId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'hashed_password',
        role: EmployeeModel.Role.ADMIN,
        phone: '351912345678',
        nif: '123456789',
        status: EmployeeModel.Status.ACTIVE,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
        removedAt: null,
      });
    });

    it('should return null if no employee is found', async () => {
      const { sut, employeeModelMock } = makeSut();

      const email = 'nonexistent@example.com';

      jest.spyOn(employeeModelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await sut.findByEmail(email);
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should findById employee and map the document snapshot', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const lean = jest.fn().mockResolvedValueOnce({
        _id: employeeId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'hashed_password',
        role: EmployeeModel.Role.ADMIN,
        phone: '351912345678',
        nif: 123456789,
        status: EmployeeModel.Status.ACTIVE,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
        removedAt: null,
      });
      const findByIdSpy = jest
        .spyOn(employeeModelMock, 'findById')
        .mockReturnValueOnce({ lean });

      const result = await sut.findById(employeeId);

      expect(findByIdSpy).toHaveBeenCalledWith(employeeId);
      expect(result).toEqual({
        id: employeeId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'hashed_password',
        role: EmployeeModel.Role.ADMIN,
        phone: '351912345678',
        nif: '123456789',
        status: EmployeeModel.Status.ACTIVE,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
        removedAt: null,
      });
    });

    it('should return null if no employee is found', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'findById').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await sut.findById(employeeId);

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should $set only status and deactivateAt by id', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const deactivateAt = new Date('2024-06-01T00:00:00Z');
      const updateOneSpy = jest.spyOn(employeeModelMock, 'updateOne');

      await sut.updateStatus({
        id: employeeId,
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt,
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        {
          $set: {
            status: EmployeeModel.Status.INACTIVE,
            deactivateAt,
          },
        },
      );
    });
  });

  describe('create', () => {
    it('should create a new employee with a valid Mongoose query', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeData: EmployeeModel.toCreate = {
        id: new mongoose.Types.ObjectId().toHexString(),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        role: EmployeeModel.Role.MANAGER,
        password: 'hashed_password',
        phone: '351912345678',
        nif: '987654321',
        status: EmployeeModel.Status.ACTIVE,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
        removedAt: null,
      };
      const createSpy = jest
        .spyOn(employeeModelMock, 'create')
        .mockResolvedValueOnce({
          _id: employeeData.id,
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          role: EmployeeModel.Role.MANAGER,
          password: 'hashed_password',
          phone: '351912345678',
          nif: 987654321,
          status: EmployeeModel.Status.ACTIVE,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          deactivateAt: null,
          removedAt: null,
        });
      const result = await sut.create(employeeData);
      expect(createSpy).toHaveBeenCalledWith({
        _id: new mongoose.Types.ObjectId(employeeData.id),
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        role: EmployeeModel.Role.MANAGER,
        password: 'hashed_password',
        phone: '351912345678',
        nif: 987654321,
        status: EmployeeModel.Status.ACTIVE,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
        removedAt: null,
      });
      expect(result).toEqual({ id: employeeData.id });
    });
  });

  describe('findAll', () => {
    it('should find employees with pagination and return items plus total', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const lean = jest.fn().mockResolvedValueOnce([
        {
          _id: employeeId,
          name: 'John Doe',
          email: 'john.doe@example.com',
          password: 'hashed_password',
          role: EmployeeModel.Role.ADMIN,
          phone: '351912345678',
          nif: 123456789,
          status: EmployeeModel.Status.ACTIVE,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          deactivateAt: null,
          removedAt: null,
        },
      ]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      const findSpy = jest
        .spyOn(employeeModelMock, 'find')
        .mockReturnValueOnce({ sort });
      const countSpy = jest
        .spyOn(employeeModelMock, 'countDocuments')
        .mockResolvedValueOnce(45);

      const result = await sut.findAll({ skip: 20, limit: 10 });

      expect(findSpy).toHaveBeenCalledWith({
        status: { $ne: employeeStatuses.REMOVED },
      });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(skip).toHaveBeenCalledWith(20);
      expect(limit).toHaveBeenCalledWith(10);
      expect(countSpy).toHaveBeenCalledWith({
        status: { $ne: employeeStatuses.REMOVED },
      });
      expect(result).toEqual({
        items: [
          {
            id: employeeId,
            name: 'John Doe',
            email: 'john.doe@example.com',
            role: EmployeeModel.Role.ADMIN,
            phone: '351912345678',
            nif: '123456789',
            status: EmployeeModel.Status.ACTIVE,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            deactivateAt: null,
          },
        ],
        total: 45,
      });
      expect(result.items[0]).not.toHaveProperty('password');
    });

    it('should apply status and role filters when provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const lean = jest.fn().mockResolvedValueOnce([]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      const findSpy = jest
        .spyOn(employeeModelMock, 'find')
        .mockReturnValueOnce({ sort });
      const countSpy = jest
        .spyOn(employeeModelMock, 'countDocuments')
        .mockResolvedValueOnce(0);

      await sut.findAll({
        status: EmployeeModel.Status.ACTIVE,
        role: EmployeeModel.Role.MANAGER,
        skip: 0,
        limit: 20,
      });

      const expectedFilter = {
        status: { $eq: employeeStatuses.ACTIVE, $ne: employeeStatuses.REMOVED },
        role: EmployeeModel.Role.MANAGER,
      };
      expect(findSpy).toHaveBeenCalledWith(expectedFilter);
      expect(countSpy).toHaveBeenCalledWith(expectedFilter);
    });

    it('should apply INACTIVE status filter when listing inactive employees', async () => {
      const { sut, employeeModelMock } = makeSut();
      const lean = jest.fn().mockResolvedValueOnce([]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      const findSpy = jest
        .spyOn(employeeModelMock, 'find')
        .mockReturnValueOnce({ sort });
      const countSpy = jest
        .spyOn(employeeModelMock, 'countDocuments')
        .mockResolvedValueOnce(0);

      await sut.findAll({
        status: EmployeeModel.Status.INACTIVE,
        skip: 0,
        limit: 20,
      });

      const expectedFilter = {
        status: {
          $eq: employeeStatuses.INACTIVE,
          $ne: employeeStatuses.REMOVED,
        },
      };
      expect(findSpy).toHaveBeenCalledWith(expectedFilter);
      expect(countSpy).toHaveBeenCalledWith(expectedFilter);
    });

    it('should apply search across name, email, phone and nif', async () => {
      const { sut, employeeModelMock } = makeSut();
      const lean = jest.fn().mockResolvedValueOnce([]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      const findSpy = jest
        .spyOn(employeeModelMock, 'find')
        .mockReturnValueOnce({ sort });
      const countSpy = jest
        .spyOn(employeeModelMock, 'countDocuments')
        .mockResolvedValueOnce(3);

      await sut.findAll({
        search: 'grau.+(test)',
        status: EmployeeModel.Status.ACTIVE,
        skip: 0,
        limit: 20,
      });

      const expectedFilter = {
        status: { $eq: employeeStatuses.ACTIVE, $ne: employeeStatuses.REMOVED },
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

    it('should return an empty list when no employees are found', async () => {
      const { sut, employeeModelMock } = makeSut();
      const lean = jest.fn().mockResolvedValueOnce([]);
      const limit = jest.fn().mockReturnValueOnce({ lean });
      const skip = jest.fn().mockReturnValueOnce({ limit });
      const sort = jest.fn().mockReturnValueOnce({ skip });
      jest.spyOn(employeeModelMock, 'find').mockReturnValueOnce({ sort });
      jest.spyOn(employeeModelMock, 'countDocuments').mockResolvedValueOnce(0);

      const result = await sut.findAll({ skip: 0, limit: 20 });

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('countNonRemovedAdmins', () => {
    it('should call countDocuments with correct filter', async () => {
      const { sut, employeeModelMock } = makeSut();
      const countSpy = jest
        .spyOn(employeeModelMock, 'countDocuments')
        .mockResolvedValueOnce(2);

      await sut.countNonRemovedAdmins();

      expect(countSpy).toHaveBeenCalledWith({
        role: employeeStatuses.ADMIN,
        status: { $ne: employeeStatuses.REMOVED },
      });
    });

    it('should return the numeric result', async () => {
      const { sut, employeeModelMock } = makeSut();
      jest.spyOn(employeeModelMock, 'countDocuments').mockResolvedValueOnce(2);

      const result = await sut.countNonRemovedAdmins();

      expect(result).toBe(2);
    });
  });

  describe('countActiveAdmins', () => {
    it('should call countDocuments with role ADMIN and status ACTIVE', async () => {
      const { sut, employeeModelMock } = makeSut();
      const countSpy = jest
        .spyOn(employeeModelMock, 'countDocuments')
        .mockResolvedValueOnce(1);

      await sut.countActiveAdmins();

      expect(countSpy).toHaveBeenCalledWith({
        role: employeeStatuses.ADMIN,
        status: employeeStatuses.ACTIVE,
      });
    });

    it('should return the numeric result', async () => {
      const { sut, employeeModelMock } = makeSut();
      jest.spyOn(employeeModelMock, 'countDocuments').mockResolvedValueOnce(1);

      const result = await sut.countActiveAdmins();

      expect(result).toBe(1);
    });
  });

  describe('anonymize', () => {
    it('should call updateOne with $set of the six fields only (no role/deactivateAt)', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const removedAt = new Date('2025-01-15T10:00:00Z');
      const updateOneSpy = jest.spyOn(employeeModelMock, 'updateOne');

      await sut.anonymize({
        id: employeeId,
        name: 'anonymized',
        email: `removed-${employeeId}@removed.invalid`,
        phone: null,
        nif: null,
        password: 'hashed_anonymous',
        status: EmployeeModel.Status.REMOVED,
        removedAt,
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        {
          $set: {
            name: 'anonymized',
            email: `removed-${employeeId}@removed.invalid`,
            phone: null,
            nif: null,
            password: 'hashed_anonymous',
            status: EmployeeModel.Status.REMOVED,
            removedAt,
          },
        },
      );
      const setPayload = (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;
      expect(setPayload).not.toHaveProperty('role');
      expect(setPayload).not.toHaveProperty('deactivateAt');
    });
  });
});
