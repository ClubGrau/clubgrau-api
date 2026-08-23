import {
  RemoveEmployeeDto,
  RemoveEmployeeResultDto,
} from '../../dtos/remove-employee.dto';

export interface RemoveEmployeePort {
  execute(params: RemoveEmployeeDto): Promise<RemoveEmployeeResultDto>;
}
