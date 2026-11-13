import {
  UpdateCustomerDto,
  UpdateCustomerResultDto,
} from '../../dtos/update-customer.dto';

export interface UpdateCustomerPort {
  execute(params: UpdateCustomerDto): Promise<UpdateCustomerResultDto>;
}
