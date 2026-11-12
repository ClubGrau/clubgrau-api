import { CustomerModel } from '@modules/customers/domain/models/customer.model';

export interface RemoveCustomerRepositoryPort {
  /** `false` when the customer was already removed (or does not exist). */
  remove(customer: CustomerModel.toCreate): Promise<boolean>;
}
