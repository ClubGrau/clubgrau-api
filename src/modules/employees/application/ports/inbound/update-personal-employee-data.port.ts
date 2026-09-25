import {
  UpdatePersonalEmployeeDataDto,
  UpdatePersonalEmployeeDataResultDto,
} from '../../dtos/update-personal-employee-data.dto';

export interface UpdatePersonalEmployeeDataPort {
  execute(
    params: UpdatePersonalEmployeeDataDto,
  ): Promise<UpdatePersonalEmployeeDataResultDto>;
}
