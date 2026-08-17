import mongoose from 'mongoose';
import { makeChainableMock } from '@configs/database/mongoose/testables';
import {
  EmployeeDocument,
  EmployeeMongooseModel,
} from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { EmployeeAuthAdapter } from './employee-auth.adapter';

const mockEmployee = {
  _id: new mongoose.Types.ObjectId(),
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: 'MANAGER',
  password: 'hashed_password',
  nif: 123456789,
  status: 'ACTIVE',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  deactivateAt: null,
} as EmployeeDocument;

const mongooseMocks = () => makeChainableMock(mockEmployee);

const makeSut = () => {
  const employeeModelMock = mongooseMocks();
  const mongooseDeps = employeeModelMock as unknown as EmployeeMongooseModel;
  const sut = new EmployeeAuthAdapter(mongooseDeps);
  return {
    sut,
    employeeModelMock,
  };
};

describe('EmployeeAuthAdapter', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(EmployeeAuthAdapter);
  });

  describe('findAuthenticatableByEmail', () => {
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
            role: 'MANAGER',
            nif: 123456789,
            status: 'ACTIVE',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            deactivateAt: null,
          }),
        });

      const result = await sut.findAuthenticatableByEmail(email);
      expect(findOneSpy).toHaveBeenCalledWith({ email });
      expect(result).toEqual({
        id: employeeId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        passwordHash: 'hashed_password',
        role: 'MANAGER',
        status: 'ACTIVE',
      });
    });

    it('should return null if no employee is found', async () => {
      const { sut, employeeModelMock } = makeSut();

      const email = 'nonexistent@example.com';

      jest.spyOn(employeeModelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await sut.findAuthenticatableByEmail(email);
      expect(result).toBeNull();
    });
  });
});
