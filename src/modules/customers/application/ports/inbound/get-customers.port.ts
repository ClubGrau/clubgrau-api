import {
  GetCustomersDto,
  GetCustomersResultDto,
} from '../../dtos/get-customers.dto';

export interface GetCustomersPort {
  execute(filters: GetCustomersDto): Promise<GetCustomersResultDto>;
}
