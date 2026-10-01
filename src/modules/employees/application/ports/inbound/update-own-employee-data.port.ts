import { GetEmployeesItemDto } from '../../dtos/get-employees.dto';
import { UpdateOwnEmployeeDataDto } from '../../dtos/update-own-employee-data.dto';

export interface UpdateOwnEmployeeDataPort {
  execute(params: UpdateOwnEmployeeDataDto): Promise<GetEmployeesItemDto>;
}
