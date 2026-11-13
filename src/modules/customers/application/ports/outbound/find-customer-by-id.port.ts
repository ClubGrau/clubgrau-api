import { CustomerModel } from '@modules/customers/domain/models/customer.model';

export interface FindCustomerByIdPort {
  findById(id: string): Promise<CustomerModel.toCreate | null>;
}
