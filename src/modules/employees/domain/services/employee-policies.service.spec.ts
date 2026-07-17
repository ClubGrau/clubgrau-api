import { EmployeePoliciesService } from './employee-policies.service';

const makeSut = (): SutTypes => {
  const sut = new EmployeePoliciesService();
  return { sut };
};

type SutTypes = {
  sut: EmployeePoliciesService;
};

describe('EmployeePoliciesService', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(EmployeePoliciesService);
  });
});
