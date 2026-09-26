import {
  UpdateProfessionalEmployeeDataDto,
  UpdateProfessionalEmployeeDataResultDto,
} from '../../dtos/update-professional-employee-data.dto';

export interface UpdateProfessionalEmployeeDataPort {
  execute(
    params: UpdateProfessionalEmployeeDataDto,
  ): Promise<UpdateProfessionalEmployeeDataResultDto>;
}
