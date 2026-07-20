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
        nif: 987654321,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        deactivateAt: null,
      });
      expect(result).toEqual({ id: employeeData.id });
    });
  });

  describe('findAll', () => {
    it('should find employees with an empty filter query', async () => {
      const { sut, employeeModelMock } = makeSut();
      const employeeId = new mongoose.Types.ObjectId().toHexString();
      const lean = jest.fn().mockResolvedValueOnce([
        {
          _id: employeeId,
          name: 'John Doe',
          email: 'john.doe@example.com',
          password: 'hashed_password',
          role: EmployeeModel.Role.ADMIN,
          nif: 123456789,
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          deactivateAt: null,
        },
      ]);
      const findSpy = jest
        .spyOn(employeeModelMock, 'find')
        .mockReturnValueOnce({ lean });

      const result = await sut.findAll({});

      expect(findSpy).toHaveBeenCalledWith({});
      expect(lean).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          id: employeeId,
          name: 'John Doe',
          email: 'john.doe@example.com',
          role: EmployeeModel.Role.ADMIN,
          nif: '123456789',
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          deactivateAt: null,
        },
      ]);
      expect(result[0]).not.toHaveProperty('password');
    });

    it('should apply isActive and role filters when provided', async () => {
      const { sut, employeeModelMock } = makeSut();
      const lean = jest.fn().mockResolvedValueOnce([]);
      const findSpy = jest
        .spyOn(employeeModelMock, 'find')
        .mockReturnValueOnce({ lean });

      await sut.findAll({
        isActive: true,
        role: EmployeeModel.Role.MANAGER,
      });

      expect(findSpy).toHaveBeenCalledWith({
        isActive: true,
        role: EmployeeModel.Role.MANAGER,
      });
    });

    it('should return an empty list when no employees are found', async () => {
      const { sut, employeeModelMock } = makeSut();
      jest.spyOn(employeeModelMock, 'find').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([]),
      });

      const result = await sut.findAll({});

      expect(result).toEqual([]);
    });
  });
});
