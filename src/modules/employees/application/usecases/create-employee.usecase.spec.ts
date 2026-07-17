import { CreateEmployeeUsecase } from './create-employee.usecase';

const makeSut = (): SutTypes => {
  const sut = new CreateEmployeeUsecase();
  return { sut };
};

type SutTypes = {
  sut: CreateEmployeeUsecase;
};

describe('HireEmployeeUsecase', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(CreateEmployeeUsecase);
  });

  it('should expose a execute method', () => {
    const { sut } = makeSut();
    expect(sut.execute).toBeDefined();
    expect(sut.execute).toBeInstanceOf(Function);
  });
});
