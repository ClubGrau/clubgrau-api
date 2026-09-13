import {
  UpdateMainEmployeeDataDto,
  UpdateMainEmployeeDataResultDto,
} from '../../dtos/update-main-employee-data.dto';

export interface UpdateMainEmployeeDataPort {
  execute(
    params: UpdateMainEmployeeDataDto,
  ): Promise<UpdateMainEmployeeDataResultDto>;
}
