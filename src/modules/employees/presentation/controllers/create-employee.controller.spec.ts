import { CreateEmployeeController } from './create-employee.controller';

const makeSut = (): SutTypes => {
  const sut = new CreateEmployeeController();
  return { sut };
};

type SutTypes = {
  sut: CreateEmployeeController;
};

describe('CreateEmployeeController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CreateEmployeeController);
  });
});
