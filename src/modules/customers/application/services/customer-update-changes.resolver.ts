import { EmptyCustomerUpdateDataError } from '@modules/customers/domain/errors/customer.errors';
import { CustomerUpdateChanges } from '@modules/customers/domain/services/customer-patch.service';

export type CustomerUpdateInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  nif?: string | null;
};

export function resolveCustomerUpdateChanges(
  fields: CustomerUpdateInput,
): CustomerUpdateChanges {
  const changes = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as CustomerUpdateChanges;

  if (Object.keys(changes).length === 0) {
    throw new EmptyCustomerUpdateDataError();
  }

  return changes;
}
