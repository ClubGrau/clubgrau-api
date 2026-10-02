import {
  ActorAuthenticationFailedError,
  EmployeeNotFoundError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { makeChainableMock } from '../../../../../configs/database/mongoose/testables';
import { EmployeeMongooseRepository } from './employee-mongoose.repository';
import { EmployeeDocument, EmployeeMongooseModel } from './employee.schema';
import { mapEmployeeReadModel } from './employee.mapper';
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
  username: null,
  gender: null,
  address: null,
  languages: null,
  emergencyContact: null,
  employmentId: null,
  jobTitle: null,
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
        username: null,
        gender: null,
        address: null,
        languages: null,
        emergencyContact: null,
        employmentId: null,
        jobTitle: null,
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
        username: null,
        gender: null,
        address: null,
        languages: null,
        emergencyContact: null,
        employmentId: null,
        jobTitle: null,
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
        username: null,
        gender: null,
        address: null,
        languages: null,
        emergencyContact: null,
        employmentId: null,
        jobTitle: null,
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
          username: null,
          gender: null,
          address: null,
          languages: null,
          emergencyContact: null,
          employmentId: null,
          jobTitle: null,
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
        username: null,
        gender: null,
        address: null,
        languages: null,
        emergencyContact: null,
        employmentId: null,
        jobTitle: null,
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
            username: null,
            gender: null,
            address: null,
            languages: null,
            emergencyContact: null,
            employmentId: null,
            jobTitle: null,
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

  describe('countLoginCapableAdmins', () => {
    it('should call countDocuments with role ADMIN and status ACTIVE or VACATION', async () => {
      const { sut, employeeModelMock } = makeSut();
      const countSpy = jest
        .spyOn(employeeModelMock, 'countDocuments')
        .mockResolvedValueOnce(2);

      await sut.countLoginCapableAdmins();

      expect(countSpy).toHaveBeenCalledWith({
        role: EmployeeModel.Role.ADMIN,
        status: {
          $in: [EmployeeModel.Status.ACTIVE, EmployeeModel.Status.VACATION],
        },
      });
    });

    it('should return the numeric result', async () => {
      const { sut, employeeModelMock } = makeSut();
      jest.spyOn(employeeModelMock, 'countDocuments').mockResolvedValueOnce(2);

      const result = await sut.countLoginCapableAdmins();

      expect(result).toBe(2);
    });
  });

  describe('updateMainData', () => {
    it('should $set only name when only name is provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateMainData({ id: employeeId, name: 'Jane Doe' });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { name: 'Jane Doe' } },
      );
      const setPayload = (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;
      expect(setPayload).not.toHaveProperty('email');
      expect(setPayload).not.toHaveProperty('phone');
      expect(setPayload).not.toHaveProperty('username');
      expect(setPayload).not.toHaveProperty('password');
      expect(setPayload).not.toHaveProperty('status');
    });

    it('should include username: null in $set when clearing username', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateMainData({ id: employeeId, username: null });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { username: null } },
      );
    });

    it('should omit username from $set when username is not provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateMainData({ id: employeeId, name: 'Jane Doe' });

      const setPayload = (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;
      expect(setPayload).not.toHaveProperty('username');
    });

    it('should $set only name, email, phone and username when all four are provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateMainData({
        id: employeeId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '351912345678',
        username: 'jdoe',
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        {
          $set: {
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '351912345678',
            username: 'jdoe',
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
      expect(setPayload).not.toHaveProperty('removedAt');
    });

    it('should throw when matchedCount is 0', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 0,
        modifiedCount: 0,
      });

      await expect(
        sut.updateMainData({ id: employeeId, name: 'Jane Doe' }),
      ).rejects.toThrow('Employee main data update matched 0 documents');
    });

    it('should resolve when matchedCount is 1 and modifiedCount is 0', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 1,
        modifiedCount: 0,
      });

      await expect(
        sut.updateMainData({ id: employeeId, name: 'Jane Doe' }),
      ).resolves.toBeUndefined();
    });

    it('should filter updateOne by { _id: id }', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateMainData({ id: employeeId, name: 'Jane Doe' });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        expect.any(Object),
      );
    });
  });

  describe('updatePersonalData', () => {
    it('should $set only gender when only gender is provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updatePersonalData({ id: employeeId, gender: 'male' });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { gender: 'male' } },
      );
      const setPayload = (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;
      expect(setPayload).not.toHaveProperty('languages');
      expect(setPayload).not.toHaveProperty('nif');
      expect(setPayload).not.toHaveProperty('address');
      expect(setPayload).not.toHaveProperty('name');
      expect(setPayload).not.toHaveProperty('password');
      expect(setPayload).not.toHaveProperty('status');
    });

    it('should omit gender from $set when gender is not provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updatePersonalData({ id: employeeId, address: 'Lisboa' });

      const setPayload = (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;
      expect(setPayload).not.toHaveProperty('gender');
    });

    it('should include languages: null and address: null in $set when clearing both', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updatePersonalData({
        id: employeeId,
        languages: null,
        address: null,
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { languages: null, address: null } },
      );
    });

    it('should persist nif: null (not 0) when clearing nif', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updatePersonalData({ id: employeeId, nif: null });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { nif: null } },
      );
      const setPayload = (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;
      expect(setPayload.nif).toBeNull();
      expect(setPayload.nif).not.toBe(0);
    });

    it('should coerce a non-null nif string to Number in $set', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updatePersonalData({ id: employeeId, nif: '123456789' });

      const setPayload = (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;
      expect(setPayload.nif).toBe(123456789);
      expect(typeof setPayload.nif).toBe('number');
    });

    it('should $set only the five personal-data keys when all are provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updatePersonalData({
        id: employeeId,
        gender: 'female',
        languages: 'pt,en',
        emergencyContact: '351912345678',
        nif: '123456789',
        address: 'Lisboa',
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        {
          $set: {
            gender: 'female',
            languages: 'pt,en',
            emergencyContact: '351912345678',
            nif: 123456789,
            address: 'Lisboa',
          },
        },
      );
      const setPayload = (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;
      expect(setPayload).not.toHaveProperty('name');
      expect(setPayload).not.toHaveProperty('email');
      expect(setPayload).not.toHaveProperty('phone');
      expect(setPayload).not.toHaveProperty('password');
      expect(setPayload).not.toHaveProperty('status');
      expect(setPayload).not.toHaveProperty('role');
    });

    it('should throw a generic Error when matchedCount is 0', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 0,
        modifiedCount: 0,
      });

      const error = await sut
        .updatePersonalData({ id: employeeId, gender: 'male' })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(EmployeeNotFoundError);
      expect((error as Error).message).toBe(
        'Employee personal data update matched 0 documents',
      );
    });

    it('should resolve when matchedCount is 1 and modifiedCount is 0', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 1,
        modifiedCount: 0,
      });

      await expect(
        sut.updatePersonalData({ id: employeeId, gender: 'male' }),
      ).resolves.toBeUndefined();
    });

    it('should filter updateOne by { _id: id }', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updatePersonalData({ id: employeeId, gender: 'male' });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        expect.any(Object),
      );
    });
  });

  describe('updateOwnData', () => {
    const setOf = (updateOneSpy: jest.SpyInstance): Record<string, unknown> =>
      (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;

    it('should $set only phone when only phone is provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({
        id: employeeId,
        phone: '+351 912 345 678',
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { phone: '+351 912 345 678' } },
      );
      const setPayload = setOf(updateOneSpy);
      expect(setPayload).not.toHaveProperty('name');
      expect(setPayload).not.toHaveProperty('email');
      expect(setPayload).not.toHaveProperty('username');
      expect(setPayload).not.toHaveProperty('nif');
      expect(setPayload).not.toHaveProperty('password');
      expect(setPayload).not.toHaveProperty('status');
    });

    it('should include username: null in $set when clearing username', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({ id: employeeId, username: null });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { username: null } },
      );
    });

    it('should $set username when a string is provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({ id: employeeId, username: 'joao' });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { username: 'joao' } },
      );
    });

    it('should persist nif: null (not 0) when clearing nif', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({ id: employeeId, nif: null });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { nif: null } },
      );
      const setPayload = setOf(updateOneSpy);
      expect(setPayload.nif).toBeNull();
      expect(setPayload.nif).not.toBe(0);
    });

    it('should coerce a non-null nif string to Number in $set', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({ id: employeeId, nif: '123456789' });

      const setPayload = setOf(updateOneSpy);
      expect(setPayload.nif).toBe(123456789);
      expect(typeof setPayload.nif).toBe('number');
    });

    it('should omit address from $set when address is not provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({
        id: employeeId,
        phone: '+351 912 345 678',
      });

      expect(setOf(updateOneSpy)).not.toHaveProperty('address');
    });

    it('should $set only the eight own-data keys when all are provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({
        id: employeeId,
        name: 'Jane Doe',
        phone: '+351 912 345 678',
        username: 'joao',
        gender: 'male',
        languages: 'pt',
        emergencyContact: '351900000000',
        nif: '123456789',
        address: 'Lisboa',
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        {
          $set: {
            name: 'Jane Doe',
            phone: '+351 912 345 678',
            username: 'joao',
            gender: 'male',
            languages: 'pt',
            emergencyContact: '351900000000',
            nif: 123456789,
            address: 'Lisboa',
          },
        },
      );
      const setPayload = setOf(updateOneSpy);
      expect(Object.keys(setPayload).sort()).toEqual([
        'address',
        'emergencyContact',
        'gender',
        'languages',
        'name',
        'nif',
        'phone',
        'username',
      ]);
      expect(typeof setPayload.nif).toBe('number');
      expect(setPayload).not.toHaveProperty('email');
    });

    it('should include gender: null and languages: null in $set when clearing both', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({
        id: employeeId,
        gender: null,
        languages: null,
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { gender: null, languages: null } },
      );
    });

    it('should filter updateOne by { _id: id }', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateOwnData({
        id: employeeId,
        phone: '+351 912 345 678',
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        expect.any(Object),
      );
    });

    it('should throw a generic Error when matchedCount is 0', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 0,
        modifiedCount: 0,
      });

      const error = await sut
        .updateOwnData({ id: employeeId, phone: '+351 912 345 678' })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(EmployeeNotFoundError);
      expect(error).not.toBeInstanceOf(ActorAuthenticationFailedError);
      expect((error as Error).message).toBe(
        'Employee own data update matched 0 documents',
      );
    });

    it('should resolve when matchedCount is 1 and modifiedCount is 0', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 1,
        modifiedCount: 0,
      });

      await expect(
        sut.updateOwnData({ id: employeeId, phone: '+351 912 345 678' }),
      ).resolves.toBeUndefined();
    });

    it('should not call updateMainData or updatePersonalData', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 1,
        modifiedCount: 1,
      });
      const updateMainDataSpy = jest.spyOn(sut, 'updateMainData');
      const updatePersonalDataSpy = jest.spyOn(sut, 'updatePersonalData');

      await sut.updateOwnData({
        id: employeeId,
        phone: '+351 912 345 678',
      });

      expect(updateMainDataSpy).not.toHaveBeenCalled();
      expect(updatePersonalDataSpy).not.toHaveBeenCalled();
    });
  });

  describe('findOwnEmployee', () => {
    const ownEmployeeDocument = (
      overrides: Partial<EmployeeDocument> = {},
    ): EmployeeDocument =>
      ({
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
        username: null,
        gender: null,
        address: null,
        languages: null,
        emergencyContact: null,
        employmentId: null,
        jobTitle: null,
        ...overrides,
      }) as EmployeeDocument;

    it('should return null when no document is found and query by id only', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const findByIdSpy = jest
        .spyOn(employeeModelMock, 'findById')
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce(null),
        });

      const result = await sut.findOwnEmployee(employeeId);

      expect(result).toBeNull();
      expect(findByIdSpy).toHaveBeenCalledTimes(1);
      expect(findByIdSpy).toHaveBeenCalledWith(employeeId);
      expect(findByIdSpy.mock.calls[0]).toEqual([employeeId]);
    });

    it('should return mapEmployeeReadModel without password and with nif as string', async () => {
      const { sut, employeeModelMock } = makeSut();
      const document = ownEmployeeDocument();
      jest.spyOn(employeeModelMock, 'findById').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(document),
      });

      const result = await sut.findOwnEmployee(String(document._id));

      expect(result).toEqual(mapEmployeeReadModel(document));
      expect(result).not.toBeNull();
      expect('password' in (result as object)).toBe(false);
      expect(typeof result?.nif).toBe('string');
      expect(result?.nif).toBe('123456789');
    });

    it('should return an INACTIVE document without a status filter', async () => {
      const { sut, employeeModelMock } = makeSut();
      const document = ownEmployeeDocument({
        status: EmployeeModel.Status.INACTIVE,
      });
      const findByIdSpy = jest
        .spyOn(employeeModelMock, 'findById')
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce(document),
        });

      const result = await sut.findOwnEmployee(String(document._id));

      expect(findByIdSpy).toHaveBeenCalledWith(String(document._id));
      expect(result).toEqual(mapEmployeeReadModel(document));
      expect(result?.status).toBe(EmployeeModel.Status.INACTIVE);
    });

    it('should return a REMOVED document without a status filter', async () => {
      const { sut, employeeModelMock } = makeSut();
      const document = ownEmployeeDocument({
        status: EmployeeModel.Status.REMOVED,
      });
      const findByIdSpy = jest
        .spyOn(employeeModelMock, 'findById')
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce(document),
        });

      const result = await sut.findOwnEmployee(String(document._id));

      expect(findByIdSpy).toHaveBeenCalledWith(String(document._id));
      expect(result).toEqual(mapEmployeeReadModel(document));
      expect(result?.status).toBe(EmployeeModel.Status.REMOVED);
    });
  });

  describe('updateProfessionalData', () => {
    const setOf = (updateOneSpy: jest.SpyInstance): Record<string, unknown> =>
      (
        updateOneSpy.mock.calls[0] as unknown as [
          unknown,
          { $set: Record<string, unknown> },
        ]
      )[1].$set;

    it('should $set only jobTitle when only jobTitle is provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateProfessionalData({
        id: employeeId,
        jobTitle: 'Barbeiro',
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { jobTitle: 'Barbeiro' } },
      );
      const setPayload = setOf(updateOneSpy);
      expect(setPayload).not.toHaveProperty('role');
      expect(setPayload).not.toHaveProperty('status');
      expect(setPayload).not.toHaveProperty('deactivateAt');
      expect(setPayload).not.toHaveProperty('name');
      expect(setPayload).not.toHaveProperty('password');
      expect(setPayload).not.toHaveProperty('employmentId');
    });

    it('should include jobTitle: null in $set when clearing jobTitle', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateProfessionalData({ id: employeeId, jobTitle: null });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { jobTitle: null } },
      );
    });

    it('should omit jobTitle from $set when jobTitle is not provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateProfessionalData({
        id: employeeId,
        role: EmployeeModel.Role.MANAGER,
      });

      expect(setOf(updateOneSpy)).not.toHaveProperty('jobTitle');
    });

    it('should $set only role when only role is provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateProfessionalData({
        id: employeeId,
        role: EmployeeModel.Role.MANAGER,
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        { $set: { role: EmployeeModel.Role.MANAGER } },
      );
      const setPayload = setOf(updateOneSpy);
      expect(setPayload).not.toHaveProperty('jobTitle');
      expect(setPayload).not.toHaveProperty('status');
    });

    it('should $set only status and deactivateAt when both are provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const deactivateAt = new Date('2026-01-01T00:00:00Z');
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateProfessionalData({
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
      const setPayload = setOf(updateOneSpy);
      expect(setPayload).not.toHaveProperty('jobTitle');
      expect(setPayload).not.toHaveProperty('role');
    });

    it('should $set jobTitle, role, status and deactivateAt when all four are provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const deactivateAt = new Date('2026-01-01T00:00:00Z');
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateProfessionalData({
        id: employeeId,
        jobTitle: 'Barbeiro',
        role: EmployeeModel.Role.MANAGER,
        status: EmployeeModel.Status.INACTIVE,
        deactivateAt,
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        {
          $set: {
            jobTitle: 'Barbeiro',
            role: EmployeeModel.Role.MANAGER,
            status: EmployeeModel.Status.INACTIVE,
            deactivateAt,
          },
        },
      );
      const setPayload = setOf(updateOneSpy);
      expect(Object.keys(setPayload).sort()).toEqual([
        'deactivateAt',
        'jobTitle',
        'role',
        'status',
      ]);
    });

    it('should include deactivateAt: null in $set when clearing deactivateAt', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateProfessionalData({
        id: employeeId,
        status: EmployeeModel.Status.ACTIVE,
        deactivateAt: null,
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        {
          $set: {
            status: EmployeeModel.Status.ACTIVE,
            deactivateAt: null,
          },
        },
      );
    });

    it('should throw a generic Error when matchedCount is 0', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 0,
        modifiedCount: 0,
      });

      const error = await sut
        .updateProfessionalData({ id: employeeId, jobTitle: 'Barbeiro' })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(EmployeeNotFoundError);
      expect((error as Error).message).toBe(
        'Employee professional data update matched 0 documents',
      );
    });

    it('should resolve when matchedCount is 1 and modifiedCount is 0', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      jest.spyOn(employeeModelMock, 'updateOne').mockResolvedValueOnce({
        matchedCount: 1,
        modifiedCount: 0,
      });

      await expect(
        sut.updateProfessionalData({ id: employeeId, jobTitle: 'Barbeiro' }),
      ).resolves.toBeUndefined();
    });

    it('should filter updateOne by { _id: id }', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const updateOneSpy = jest
        .spyOn(employeeModelMock, 'updateOne')
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      await sut.updateProfessionalData({
        id: employeeId,
        jobTitle: 'Barbeiro',
      });

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: employeeId },
        expect.any(Object),
      );
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
