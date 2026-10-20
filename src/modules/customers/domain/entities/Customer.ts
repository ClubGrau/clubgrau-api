import { Entity } from '@shared/domain/entity/entity';
import { UniqueEntityId } from '@shared/domain/value-object/id/unique-entity-id.vo';
import { Email, Name, Nif, Phone } from '@shared/domain/value-object';
import { INITIAL_RANK, type Rank } from '../rank';
import { Indication } from '../value-objects/indication.vo';

interface CustomerProps {
  name: Name;
  email: Email;
  phone: Phone | null;
  nif: Nif | null;
  createdAt: Date;
  rank: Rank;
  indication: Indication | null;
}

/** Input required to create a brand new customer. */
export interface CreateCustomerProps {
  name: string;
  email: string;
  phone?: string | null;
  nif?: number | null;
  indication?: {
    categoryId: string;
    originId?: string | null;
    referrerCustomerId?: string | null;
  } | null;
}

/** Full snapshot used to rebuild a customer from persistence. */
export interface ReconstituteCustomerProps {
  id: string;
  name: Name;
  email: Email;
  phone: Phone | null;
  nif: Nif | null;
  createdAt: Date;
  rank: Rank;
  indication: Indication | null;
}

export class Customer extends Entity<CustomerProps> {
  private constructor(props: CustomerProps, id?: UniqueEntityId) {
    super(props, id);
  }

  static create(input: CreateCustomerProps): Customer {
    const indication = input.indication
      ? Indication.create(input.indication)
      : null;

    return new Customer({
      name: Name.create(input.name),
      email: Email.create(input.email),
      phone: input.phone ? Phone.create(input.phone) : null,
      nif: input.nif ? Nif.create(input.nif.toString()) : null,
      createdAt: new Date(),
      rank: INITIAL_RANK,
      indication,
    });
  }

  static reconstitute(input: ReconstituteCustomerProps): Customer {
    return new Customer(
      {
        name: input.name,
        email: input.email,
        phone: input.phone,
        nif: input.nif,
        createdAt: input.createdAt,
        rank: input.rank,
        indication: input.indication,
      },
      new UniqueEntityId(input.id),
    );
  }

  get rank(): Rank {
    return this.props.rank;
  }

  get indication(): Indication | null {
    return this.props.indication;
  }

  changeName(name: Name): void {
    this.props.name = name;
  }

  changeEmail(email: Email): void {
    this.props.email = email;
  }

  assignPhone(phone: Phone | null): void {
    this.props.phone = phone;
  }

  assignNif(nif: Nif | null): void {
    this.props.nif = nif;
  }
}
