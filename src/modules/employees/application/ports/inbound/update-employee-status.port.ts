import {
  UpdateEmployeeStatusDto,
  UpdateEmployeeStatusResultDto,
} from '../../dtos/update-employee-status.dto';

export interface UpdateEmployeeStatusPort {
  execute(
    params: UpdateEmployeeStatusDto,
  ): Promise<UpdateEmployeeStatusResultDto>;
}
