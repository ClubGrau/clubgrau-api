import { FindEmployeeByEmailPort } from '@modules/employees/application/ports/outbound/find-employee-by-email.port';

export class EmployeePoliciesService {
  constructor(private readonly findEmployeeByEmail: FindEmployeeByEmailPort) {}

  async checkEmployee(email: string): Promise<void> {
    await this.findEmployeeByEmail.findByEmail(email);
  }
}
