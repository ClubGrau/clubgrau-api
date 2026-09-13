import { Employee } from '../entities/Employee';
import {
  EmployeeAlreadyExistsError,
  EmployeeInactiveError,
} from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { EmployeePoliciesService } from './employee-policies.service';
import { EmployeeMainDataPatchService } from './employee-main-data-patch.service';
import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';

type EmployeePoliciesServiceStub = {
  ensureEmailIsAvailable: jest.MockedFunction<
    EmployeePoliciesService['ensureEmailIsAvailable']
  >;
};

const makeTarget = (): Employee =>
  Employee.create({
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'P@ssword123',
    role: EmployeeModel.Role.EMPLOYEE,
    username: 'old.user',
  });

const makeSut = () => {
  const employeePoliciesServiceStub: EmployeePoliciesServiceStub = {
    ensureEmailIsAvailable: jest.fn().mockResolvedValue(undefined),
  };
  const sut = new EmployeeMainDataPatchService(
    employeePoliciesServiceStub as unknown as EmployeePoliciesService,
  );
  return { sut, employeePoliciesServiceStub };
};

describe('EmployeeMainDataPatchService', () => {
  it('should apply name patch and return persist value', async () => {
    const { sut } = makeSut();
    const target = makeTarget();

    const patch = await sut.apply(target, { name: 'Jane Smith' });

    expect(patch).toEqual({ name: 'Jane Smith' });
    expect(target.toJSON().name).toBe('Jane Smith');
  });

  it('should not call ensureEmailIsAvailable when email is unchanged', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();
    const target = makeTarget();

    await sut.apply(target, { email: 'John.Doe@Example.com' });

    expect(
      employeePoliciesServiceStub.ensureEmailIsAvailable,
    ).not.toHaveBeenCalled();
    expect(target.toJSON().email).toBe('john.doe@example.com');
  });

  it('should call ensureEmailIsAvailable when email changes', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();
    const target = makeTarget();

    const patch = await sut.apply(target, { email: 'new.email@example.com' });

    expect(
      employeePoliciesServiceStub.ensureEmailIsAvailable,
    ).toHaveBeenCalledWith('new.email@example.com');
    expect(patch).toEqual({ email: 'new.email@example.com' });
  });

  it('should propagate email availability errors', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();
    const target = makeTarget();
    employeePoliciesServiceStub.ensureEmailIsAvailable.mockRejectedValueOnce(
      new EmployeeAlreadyExistsError(),
    );

    await expect(
      sut.apply(target, { email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(EmployeeAlreadyExistsError);
  });

  it('should propagate EmployeeInactiveError from ensureEmailIsAvailable', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();
    const target = makeTarget();
    employeePoliciesServiceStub.ensureEmailIsAvailable.mockRejectedValueOnce(
      new EmployeeInactiveError(),
    );

    await expect(
      sut.apply(target, { email: 'inactive@example.com' }),
    ).rejects.toBeInstanceOf(EmployeeInactiveError);
  });

  it('should apply phone patch without calling changePhone with null', async () => {
    const { sut } = makeSut();
    const target = makeTarget();
    const changePhoneSpy = jest.spyOn(target, 'changePhone');

    const patch = await sut.apply(target, { phone: '+351 912 345 678' });

    expect(changePhoneSpy).toHaveBeenCalled();
    expect(changePhoneSpy).not.toHaveBeenCalledWith(null);
    expect(patch).toEqual({ phone: '351912345678' });
  });

  it('should clear username when blank', async () => {
    const { sut } = makeSut();
    const target = makeTarget();

    const patch = await sut.apply(target, { username: '   ' });

    expect(patch).toEqual({ username: null });
    expect(target.toJSON().username).toBeNull();
  });

  it('should apply multiple fields in one patch', async () => {
    const { sut, employeePoliciesServiceStub } = makeSut();
    const target = makeTarget();

    const patch = await sut.apply(target, {
      name: 'Jane Smith',
      username: '  jdoe  ',
    });

    expect(
      employeePoliciesServiceStub.ensureEmailIsAvailable,
    ).not.toHaveBeenCalled();
    expect(patch).toEqual({ name: 'Jane Smith', username: 'jdoe' });
  });

  it('should throw InvalidNameError for invalid name', async () => {
    const { sut } = makeSut();
    const target = makeTarget();

    await expect(sut.apply(target, { name: 'A' })).rejects.toBeInstanceOf(
      InvalidNameError,
    );
  });

  it('should throw InvalidEmailError for invalid email', async () => {
    const { sut } = makeSut();
    const target = makeTarget();

    await expect(
      sut.apply(target, { email: 'not-an-email' }),
    ).rejects.toBeInstanceOf(InvalidEmailError);
  });

  it('should throw InvalidPhoneFormatError for invalid phone', async () => {
    const { sut } = makeSut();
    const target = makeTarget();

    await expect(sut.apply(target, { phone: '123' })).rejects.toBeInstanceOf(
      InvalidPhoneFormatError,
    );
  });
});
