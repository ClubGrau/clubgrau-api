import { Employee } from '@modules/employees/domain/entities/Employee';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { Email, Name, Nif, Password, Phone } from '@shared/domain/value-object';

export class EmployeeSnapshotMapper {
  static toEntity(snapshot: EmployeeModel.toCreate): Employee {
    return Employee.reconstitute({
      id: snapshot.id,
      name: Name.create(snapshot.name),
      email: Email.create(snapshot.email),
      password: Password.fromHash(snapshot.password),
      phone: snapshot.phone ? Phone.create(snapshot.phone) : null,
      nif: snapshot.nif ? Nif.create(snapshot.nif) : null,
      role: snapshot.role,
      status: snapshot.status,
      username: snapshot.username ?? null,
      createdAt: snapshot.createdAt,
      deactivateAt: snapshot.deactivateAt,
      removedAt: snapshot.removedAt ?? null,
    });
  }
}
