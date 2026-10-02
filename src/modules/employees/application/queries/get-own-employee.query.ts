import { ActorAuthenticationFailedError } from '@modules/employees/domain/errors/employee.errors';
import { EmployeeOwnDataPolicy } from '@modules/employees/domain/services/employee-own-data.policy';
import { GetEmployeesItemDto } from '../dtos/get-employees.dto';
import { GetOwnEmployeePort } from '../ports/inbound/get-own-employee.port';
import { FindOwnEmployeePort } from '../ports/outbound/find-own-employee.port';

export class GetOwnEmployeeQuery implements GetOwnEmployeePort {
  constructor(
    private readonly findOwnEmployee: FindOwnEmployeePort,
    private readonly ownDataPolicy: EmployeeOwnDataPolicy,
  ) {}

  async execute(params: { actorId: string }): Promise<GetEmployeesItemDto> {
    const { actorId } = params;

    if (!actorId?.trim()) {
      throw new ActorAuthenticationFailedError();
    }

    const readModel = await this.findOwnEmployee.findOwnEmployee(actorId);
    if (!readModel) {
      throw new ActorAuthenticationFailedError();
    }

    this.ownDataPolicy.assertCan(readModel.status);

    return readModel;
  }
}
