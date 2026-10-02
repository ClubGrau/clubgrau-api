import { GetEmployeesItemDto } from '../../dtos/get-employees.dto';

export interface GetOwnEmployeePort {
  execute(params: { actorId: string }): Promise<GetEmployeesItemDto>;
}
