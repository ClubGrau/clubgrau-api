import { Employee } from '@modules/employees/domain/entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeNotFoundError,
  InvalidEmployeeStatusError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import {
  EmployeeLifecyclePolicy,
  LifecycleIntent,
} from '@modules/employees/domain/services/employee-lifecycle.policy';
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
    private readonly lifecyclePolicy: EmployeeLifecyclePolicy,
  ) {}

  async execute(
    params: UpdateEmployeeStatusDto,
  ): Promise<UpdateEmployeeStatusResultDto> {
    const error = new ActorAuthenticationFailedError();
    if (!params.actorId?.trim()) throw error;

    const actorSnapshot = await this.findEmployeeById.findById(params.actorId);
    if (!actorSnapshot) throw error;

    const targetEmployeeSnapshot = await this.findEmployeeById.findById(
      params.id,
    );
    if (!targetEmployeeSnapshot) {
      throw new EmployeeNotFoundError();
    }

    const actor = this.reconstitute(actorSnapshot);
    const target = this.reconstitute(targetEmployeeSnapshot);
    const intent = this.mapIntent(params.status);

    await this.lifecyclePolicy.assertCan({ actor, target, intent });
    this.applyTransition(target, params.status);

    await this.updateEmployeeStatusRepository.updateStatus({
      id: target.id,
      status: target.status,
      deactivateAt: target.toJSON().deactivateAt,
    });

    return { id: target.id, status: target.status };
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
      removedAt: snapshot.removedAt ?? null,
    });
  }

  private mapIntent(status: EmployeeModel.OperationalStatus): LifecycleIntent {
    switch (status) {
      case EmployeeModel.Status.ACTIVE:
        return 'REACTIVATE';
      case EmployeeModel.Status.INACTIVE:
        return 'DEACTIVATE';
      case EmployeeModel.Status.VACATION:
        return 'VACATION';
      default: {
        const exhaustive: never = status;
        throw new InvalidEmployeeStatusError(`Invalid status: "${exhaustive}"`);
      }
    }
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
      case EmployeeModel.Status.REMOVED:
        throw new InvalidEmployeeStatusError(`Invalid status: "${status}"`);
      default: {
        const exhaustive: never = status;
        throw new InvalidEmployeeStatusError(`Invalid status: "${exhaustive}"`);
      }
    }
  }
}
