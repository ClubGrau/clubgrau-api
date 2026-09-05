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
        loginCapable: true,
        sessionVersion: 0,
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

  describe('findAuthenticatableById', () => {
    it('should findOne employee by _id with a valid Mongoose query', async () => {
      const { sut, employeeModelMock } = makeSut();

      const employeeId = new mongoose.Types.ObjectId().toHexString();

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

      const result = await sut.findAuthenticatableById(employeeId);
      expect(findOneSpy).toHaveBeenCalledWith({ _id: employeeId });
      expect(result).toEqual({
        id: employeeId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        passwordHash: 'hashed_password',
        role: 'MANAGER',
        status: 'ACTIVE',
        loginCapable: true,
        sessionVersion: 0,
      });
    });

    it('should return null if no employee is found', async () => {
      const { sut, employeeModelMock } = makeSut();

      const employeeId = new mongoose.Types.ObjectId().toHexString();

      jest.spyOn(employeeModelMock, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await sut.findAuthenticatableById(employeeId);
      expect(result).toBeNull();
    });

    it('should return null for an invalid ObjectId without querying', async () => {
      const { sut, employeeModelMock } = makeSut();

      const findOneSpy = jest.spyOn(employeeModelMock, 'findOne');

      const result = await sut.findAuthenticatableById('not-an-object-id');
      expect(result).toBeNull();
      expect(findOneSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateCredentials', () => {
    it('should findOneAndUpdate password and increment sessionVersion', async () => {
      const { sut, employeeModelMock } = makeSut();
      const ownerId = new mongoose.Types.ObjectId().toHexString();
      const findOneAndUpdateSpy = jest
        .spyOn(employeeModelMock, 'findOneAndUpdate')
        .mockResolvedValueOnce(null);

      await sut.updateCredentials(ownerId, 'new-password-hash');

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { _id: ownerId },
        {
          $set: { password: 'new-password-hash' },
          $inc: { sessionVersion: 1 },
        },
      );
    });

    it('should not call findOneAndUpdate for an invalid ObjectId', async () => {
      const { sut, employeeModelMock } = makeSut();
      const findOneAndUpdateSpy = jest.spyOn(
        employeeModelMock,
        'findOneAndUpdate',
      );

      await sut.updateCredentials('not-an-object-id', 'new-password-hash');

      expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
    });
  });
});
