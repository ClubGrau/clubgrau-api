import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { makeChainableMock } from '../../../../../configs/database/mongoose/testables';
import { EmployeeMongooseRepository } from './employee-mongoose.repository';
import { EmployeeDocument, EmployeeMongooseModel } from './employee.schema';
import mongoose from 'mongoose';

const mockEmployee = {
  _id: new mongoose.Types.ObjectId(),
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: EmployeeModel.Role.ADMIN,
  password: 'hashed_password',
  phone: '351912345678',
  nif: 123456789,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  deactivateAt: null,
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
            isActive: true,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            deactivateAt: null,
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
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
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
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
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
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          deactivateAt: null,
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
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
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
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          deactivateAt: null,
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

      expect(findSpy).toHaveBeenCalledWith({});
      expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(skip).toHaveBeenCalledWith(20);
      expect(limit).toHaveBeenCalledWith(10);
      expect(countSpy).toHaveBeenCalledWith({});
      expect(result).toEqual({
        items: [
          {
            id: employeeId,
            name: 'John Doe',
            email: 'john.doe@example.com',
            role: EmployeeModel.Role.ADMIN,
            phone: '351912345678',
            nif: '123456789',
            isActive: true,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            deactivateAt: null,
          },
        ],
        total: 45,
      });
      expect(result.items[0]).not.toHaveProperty('password');
    });

    it('should apply isActive and role filters when provided', async () => {
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
        isActive: true,
        role: EmployeeModel.Role.MANAGER,
        skip: 0,
        limit: 20,
      });

      const expectedFilter = {
        isActive: true,
        role: EmployeeModel.Role.MANAGER,
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
});
