import { Employee } from '@modules/employees/domain/entities/Employee';
import {
  EmployeeNotFoundError,
  InvalidEmployeeStatusError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { Email, Name, Nif, Password, Phone } from '@shared/domain/value-object';
import {
  UpdateEmployeeStatusDto,
  UpdateEmployeeStatusResultDto,
} from '../dtos/update-employee-status.dto';
import { UpdateEmployeeStatusPort } from '../ports/inbound/update-employee-status.port';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { UpdateEmployeeStatusRepositoryPort } from '../ports/outbound/update-employee-status-repository.port';

export class UpdateEmployeeStatusUsecase implements UpdateEmployeeStatusPort {
  constructor(
    private readonly findEmployeeById: FindEmployeeByIdPort,
    private readonly updateEmployeeStatusRepository: UpdateEmployeeStatusRepositoryPort,
  ) {}

  async execute(
    params: UpdateEmployeeStatusDto,
  ): Promise<UpdateEmployeeStatusResultDto> {
    const isEmployee = await this.findEmployeeById.findById(params.id);
    if (!isEmployee) {
      throw new EmployeeNotFoundError();
    }

    const employee = this.reconstitute(isEmployee);
    this.applyTransition(employee, params.status);

    await this.updateEmployeeStatusRepository.updateStatus({
      id: employee.id,
      status: employee.status,
      deactivateAt: employee.toJSON().deactivateAt,
    });

    return { id: employee.id, status: employee.status };
  }

  private reconstitute(snapshot: EmployeeModel.toCreate): Employee {
    return Employee.reconstitute({
      id: snapshot.id,
      name: Name.create(snapshot.name),
      email: Email.create(snapshot.email),
      password: Password.fromHash(snapshot.password),
      phone: snapshot.phone ? Phone.create(snapshot.phone) : null,
      nif: snapshot.nif ? Nif.create(snapshot.nif) : null,
      role: snapshot.role,
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      deactivateAt: snapshot.deactivateAt,
    });
  }

  private applyTransition(
    employee: Employee,
    status: EmployeeModel.Status,
  ): void {
    switch (status) {
      case EmployeeModel.Status.ACTIVE:
        employee.activate();
        return;
      case EmployeeModel.Status.INACTIVE:
        employee.deactivate();
        return;
      case EmployeeModel.Status.VACATION:
        employee.putOnVacation();
        return;
      default: {
        const exhaustive: never = status;
        throw new InvalidEmployeeStatusError(`Invalid status: "${exhaustive}"`);
      }
    }
  }
}
