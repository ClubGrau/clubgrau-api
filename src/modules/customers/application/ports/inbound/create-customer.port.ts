import {
  CreateCustomerDto,
  CreateCustomerResultDto,
} from '../../dtos/create-customer.dto';

export interface CreateCustomerPort {
  execute(params: CreateCustomerDto): Promise<CreateCustomerResultDto>;
}
