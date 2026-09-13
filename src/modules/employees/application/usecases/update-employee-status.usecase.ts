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
import {
  UpdateEmployeeStatusDto,
  UpdateEmployeeStatusResultDto,
} from '../dtos/update-employee-status.dto';
import { EmployeeSnapshotMapper } from '../mappers/employee-snapshot.mapper';
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

    const actor = EmployeeSnapshotMapper.toEntity(actorSnapshot);
    const target = EmployeeSnapshotMapper.toEntity(targetEmployeeSnapshot);
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
