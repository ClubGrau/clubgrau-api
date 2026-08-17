import { UpdateEmployeeStatusPort } from '@modules/employees/application/ports/inbound/update-employee-status.port';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { UpdateEmployeeStatusRequest } from '@modules/employees/presentation/http/update-employee-status.request';
import { MissingParamError } from '@shared/presentation/errors/missing-param.error';
import { UpdateEmployeeStatusController } from './update-employee-status.controller';

const VALID_EMPLOYEE_ID = '507f1f77bcf86cd799439011';

const makeValidRequest = (
  overrides: UpdateEmployeeStatusRequest = {},
): UpdateEmployeeStatusRequest => ({
  id: VALID_EMPLOYEE_ID,
  status: EmployeeModel.Status.INACTIVE,
  ...overrides,
});

const makeStubs = () => ({
  updateEmployeeStatusStub: {
    execute: jest.fn().mockResolvedValue({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    }),
  } satisfies UpdateEmployeeStatusPort,
});

const makeSut = (): SutTypes => {
  const { updateEmployeeStatusStub } = makeStubs();
  const sut = new UpdateEmployeeStatusController(updateEmployeeStatusStub);
  return { sut, updateEmployeeStatusStub };
};

type SutTypes = {
  sut: UpdateEmployeeStatusController;
  updateEmployeeStatusStub: UpdateEmployeeStatusPort;
};

describe('UpdateEmployeeStatusController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(UpdateEmployeeStatusController);
  });

  it('should return 400 if id is not provided', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    const response = await sut.handle(makeValidRequest({ id: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('id').message,
    });
    expect(updateEmployeeStatusSpy).not.toHaveBeenCalled();
  });

  it('should return 400 if status is not provided', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    const response = await sut.handle(makeValidRequest({ status: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: new MissingParamError('status').message,
    });
    expect(updateEmployeeStatusSpy).not.toHaveBeenCalled();
  });

  it('should return 400 when status is invalid', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    const response = await sut.handle(makeValidRequest({ status: 'active' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid param status' });
    expect(updateEmployeeStatusSpy).not.toHaveBeenCalled();
  });

  it.each(Object.values(EmployeeModel.Status))(
    'should accept %s as a valid status',
    async (status) => {
      const { sut, updateEmployeeStatusStub } = makeSut();
      const updateEmployeeStatusSpy = jest.spyOn(
        updateEmployeeStatusStub,
        'execute',
      );

      await sut.handle(makeValidRequest({ status }));

      expect(updateEmployeeStatusSpy).toHaveBeenCalledWith({
        id: VALID_EMPLOYEE_ID,
        status,
      });
    },
  );

  it('should call UpdateEmployeeStatusPort with correct values', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const request = makeValidRequest();
    const updateEmployeeStatusSpy = jest.spyOn(
      updateEmployeeStatusStub,
      'execute',
    );

    await sut.handle(request);

    expect(updateEmployeeStatusSpy).toHaveBeenCalledWith({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
  });

  it('should return 500 if UpdateEmployeeStatusPort throws', async () => {
    const { sut, updateEmployeeStatusStub } = makeSut();
    const updateEmployeeStatusSpy = jest
      .spyOn(updateEmployeeStatusStub, 'execute')
      .mockRejectedValue(new Error('UpdateEmployeeStatusPort error'));

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'UpdateEmployeeStatusPort error',
    });
    expect(updateEmployeeStatusSpy).toHaveBeenCalledWith({
      id: VALID_EMPLOYEE_ID,
      status: EmployeeModel.Status.INACTIVE,
    });
  });

  it('should return 200 if employee status is updated successfully', async () => {
    const { sut } = makeSut();

    const response = await sut.handle(makeValidRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: VALID_EMPLOYEE_ID,
        status: EmployeeModel.Status.INACTIVE,
      },
    });
  });
});
