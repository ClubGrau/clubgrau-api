import { ActorAuthenticationFailedError } from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { EmployeeOwnDataPolicy } from './employee-own-data.policy';

const makeSut = (): EmployeeOwnDataPolicy => new EmployeeOwnDataPolicy();

describe('EmployeeOwnDataPolicy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const sut = makeSut();
    expect(sut).toBeInstanceOf(EmployeeOwnDataPolicy);
  });

  it.each([EmployeeModel.Status.ACTIVE, EmployeeModel.Status.VACATION])(
    'should allow status %s',
    (status) => {
      const sut = makeSut();

      expect(() => sut.assertCan(status)).not.toThrow();
    },
  );

  it.each([EmployeeModel.Status.INACTIVE, EmployeeModel.Status.REMOVED])(
    'should throw ActorAuthenticationFailedError when status is %s',
    (status) => {
      const sut = makeSut();

      expect(() => sut.assertCan(status)).toThrow(
        ActorAuthenticationFailedError,
      );
    },
  );

  it('should throw ActorAuthenticationFailedError for any other status', () => {
    const sut = makeSut();

    expect(() => sut.assertCan('UNKNOWN' as EmployeeModel.Status)).toThrow(
      ActorAuthenticationFailedError,
    );
  });
});
