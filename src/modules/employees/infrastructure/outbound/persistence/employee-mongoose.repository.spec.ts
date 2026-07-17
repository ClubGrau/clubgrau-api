import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { makeChainableMock } from '../../../../../configs/database/mongoose/testables';
import { EmployeeMongooseRepository } from './employee-mongoose.repository';
import { EmployeeDocument } from './employee.schema';
import mongoose, { Model } from 'mongoose';
import { setupMongoMemoryServer } from '../../../../../configs/database/mongoose/test-setup-mongoose-menory';

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
  const mongooseDeps = employeeModelMock as unknown as Model<EmployeeDocument>;
  const sut = new EmployeeMongooseRepository(mongooseDeps);
  return { sut, employeeModelMock };
};

describe('EmployeeMongooseRepository', () => {
  setupMongoMemoryServer();

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(EmployeeMongooseRepository);
  });

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
