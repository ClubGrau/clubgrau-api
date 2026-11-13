import { Customer } from '@modules/customers/domain/entities/Customer';
import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { Indication } from '@modules/customers/domain/value-objects/indication.vo';
import { Email, Name, Nif, Phone } from '@shared/domain/value-object';

export class CustomerSnapshotMapper {
  static toEntity(snapshot: CustomerModel.toCreate): Customer {
    return Customer.reconstitute({
      id: snapshot.id,
      name: Name.create(snapshot.name),
      email: Email.create(snapshot.email),
      phone: snapshot.phone ? Phone.create(snapshot.phone) : null,
      nif: snapshot.nif ? Nif.create(snapshot.nif) : null,
      createdAt: snapshot.createdAt,
      rank: snapshot.rank,
      indication: snapshot.indication
        ? Indication.reconstitute(snapshot.indication)
        : null,
      removedAt: snapshot.removedAt ?? null,
    });
  }
}
