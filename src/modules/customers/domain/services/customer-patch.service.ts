import { Email, Name, Nif, Phone } from '@shared/domain/value-object';
import { Customer } from '../entities/Customer';
import { CustomerAlreadyRemovedError } from '../errors/customer.errors';
import { CustomerPoliciesService } from './customer-policies.service';

export type CustomerUpdatableField = 'name' | 'email' | 'phone' | 'nif';

export type CustomerUpdateChanges = {
  name?: string;
  email?: string;
  phone?: string | null;
  nif?: string | null;
};

export type CustomerPersistPatch = {
  name?: string;
  email?: string;
  phone?: string | null;
  nif?: string | null;
};

type ValidatedCustomerChanges = {
  name?: Name;
  email?: Email;
  phone?: Phone | null;
  nif?: Nif | null;
};

export class CustomerPatchService {
  constructor(
    private readonly customerPoliciesService: CustomerPoliciesService,
  ) {}

  async apply(
    customer: Customer,
    changes: CustomerUpdateChanges,
  ): Promise<CustomerPersistPatch> {
    if (customer.isRemoved) {
      throw new CustomerAlreadyRemovedError();
    }

    const validated = this.validateChanges(changes);

    if (validated.email && validated.email.value !== customer.email.value) {
      await this.customerPoliciesService.ensureEmailIsAvailable(
        validated.email.value,
      );
    }

    return this.commitChanges(customer, validated);
  }

  private validateChanges(
    changes: CustomerUpdateChanges,
  ): ValidatedCustomerChanges {
    const validated: ValidatedCustomerChanges = {};

    if ('name' in changes) {
      validated.name = Name.create(changes.name!);
    }

    if ('email' in changes) {
      validated.email = Email.create(changes.email!);
    }

    if ('phone' in changes) {
      validated.phone = changes.phone ? Phone.create(changes.phone) : null;
    }

    if ('nif' in changes) {
      validated.nif = changes.nif ? Nif.create(changes.nif) : null;
    }

    return validated;
  }

  private commitChanges(
    customer: Customer,
    validated: ValidatedCustomerChanges,
  ): CustomerPersistPatch {
    const patch: CustomerPersistPatch = {};

    if (validated.name) {
      customer.changeName(validated.name);
      patch.name = validated.name.value;
    }

    if (validated.email) {
      customer.changeEmail(validated.email);
      patch.email = validated.email.value;
    }

    if ('phone' in validated) {
      customer.assignPhone(validated.phone ?? null);
      patch.phone = validated.phone?.value ?? null;
    }

    if ('nif' in validated) {
      customer.assignNif(validated.nif ?? null);
      patch.nif = validated.nif?.value ?? null;
    }

    return patch;
  }
}
