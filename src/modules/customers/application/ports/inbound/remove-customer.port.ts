import {
  RemoveCustomerDto,
  RemoveCustomerResultDto,
} from '../../dtos/remove-customer.dto';

export interface RemoveCustomerPort {
  execute(params: RemoveCustomerDto): Promise<RemoveCustomerResultDto>;
}
