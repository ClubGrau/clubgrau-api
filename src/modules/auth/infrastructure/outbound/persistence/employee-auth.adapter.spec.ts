import { EmployeeAuthAdapter } from './employee-auth.adapter';

const makeSut = () => {
  const sut = new EmployeeAuthAdapter();
  return {
    sut,
  };
};

describe('EmployeeAuthAdapter', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(EmployeeAuthAdapter);
  });
});
