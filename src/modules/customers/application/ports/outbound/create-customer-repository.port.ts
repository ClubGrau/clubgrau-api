import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { CreateCustomerResultDto } from '../../dtos/create-customer.dto';

export interface CreateCustomerRepositoryPort {
  create(customer: CustomerModel.toCreate): Promise<CreateCustomerResultDto>;
}
