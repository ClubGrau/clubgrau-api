import { Entity } from '@shared/domain/entity/entity';
import { UniqueEntityId } from '@shared/domain/value-object/id/unique-entity-id.vo';
import { Email, Name, Nif, Password, Phone } from '@shared/domain/value-object';
import { EmployeeModel } from '../models/employee.model';
import {
  EmployeeAlreadyActiveError,
  EmployeeAlreadyInactiveError,
  EmployeeAlreadyOnVacationError,
  InvalidEmployeeRoleError,
  InvalidEmployeeStatusError,
} from '../errors/employee.errors';

interface EmployeeProps {
  name: Name;
  email: Email;
  password: Password;
  phone: Phone | null;
  nif: Nif | null;
  role: EmployeeModel.Role;
  status: EmployeeModel.Status;
  createdAt: Date;
  deactivateAt: Date | null;
}

/** Input required to create a brand new employee. */
export interface CreateEmployeeProps {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  nif?: number | null;
  role: EmployeeModel.Role;
  createdAt?: Date;
  deactivateAt?: Date | null;
}

/** Full snapshot used to rebuild an employee from persistence. */
export interface ReconstituteEmployeeProps {
  id: string;
  name: Name;
  email: Email;
  password: Password;
  phone: Phone | null;
  nif: Nif | null;
  role: EmployeeModel.Role;
  status: EmployeeModel.Status;
  createdAt: Date;
  deactivateAt: Date | null;
}

export class Employee extends Entity<EmployeeProps> {
  private constructor(props: EmployeeProps, id?: UniqueEntityId) {
    super(props, id);
  }

  static create(input: CreateEmployeeProps): Employee {
    if (!EmployeeModel.isRole(input.role)) {
      throw new InvalidEmployeeRoleError(`Invalid role: "${input.role}"`);
    }

    return new Employee({
      name: Name.create(input.name),
      email: Email.create(input.email),
      password: Password.create(input.password),
      phone: input.phone ? Phone.create(input.phone) : null,
      nif: input.nif ? Nif.create(input.nif.toString()) : null,
      role: input.role,
      status: EmployeeModel.Status.ACTIVE,
      createdAt: new Date(),
      deactivateAt: null,
    });
  }

  static reconstitute(input: ReconstituteEmployeeProps): Employee {
    if (!EmployeeModel.isRole(input.role)) {
      throw new InvalidEmployeeRoleError(`Invalid role: "${input.role}"`);
    }
    if (!EmployeeModel.isStatus(input.status)) {
      throw new InvalidEmployeeStatusError(`Invalid status: "${input.status}"`);
    }

    return new Employee(
      {
        name: input.name,
        email: input.email,
        password: input.password,
        phone: input.phone,
        nif: input.nif,
        role: input.role,
        status: input.status,
        createdAt: input.createdAt,
        deactivateAt: input.deactivateAt,
      },
      new UniqueEntityId(input.id),
    );
  }

  deactivate(): void {
    if (this.props.status === EmployeeModel.Status.INACTIVE) {
      throw new EmployeeAlreadyInactiveError();
    }
    this.props.status = EmployeeModel.Status.INACTIVE;
    this.props.deactivateAt = new Date();
  }

  activate(): void {
    if (this.props.status === EmployeeModel.Status.ACTIVE) {
      throw new EmployeeAlreadyActiveError();
    }
    this.props.status = EmployeeModel.Status.ACTIVE;
    this.props.deactivateAt = null;
  }

  putOnVacation(): void {
    if (this.props.status === EmployeeModel.Status.VACATION) {
      throw new EmployeeAlreadyOnVacationError();
    }
    this.props.status = EmployeeModel.Status.VACATION;
    this.props.deactivateAt = null;
  }

  get status(): EmployeeModel.Status {
    return this.props.status;
  }

  get isActive(): boolean {
    return this.props.status === EmployeeModel.Status.ACTIVE;
  }

  changePassword(password: Password): void {
    this.props.password = password;
  }

  changeRole(role: EmployeeModel.Role): void {
    if (!EmployeeModel.isRole(role)) {
      throw new InvalidEmployeeRoleError(`Invalid role: "${role}"`);
    }
    this.props.role = role;
  }

  changeName(name: Name): void {
    this.props.name = name;
  }

  changeEmail(email: Email): void {
    this.props.email = email;
  }

  changePhone(phone: Phone | null): void {
    this.props.phone = phone;
  }

  assignNif(nif: Nif | null): void {
    this.props.nif = nif;
  }
}
