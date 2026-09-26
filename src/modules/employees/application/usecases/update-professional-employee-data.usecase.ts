import { Employee } from '@modules/employees/domain/entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeNotFoundError,
  InvalidEmployeeRoleError,
  InvalidEmployeeStatusError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeLifecyclePolicy } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { EmployeeProfessionalDataPolicy } from '@modules/employees/domain/services/employee-professional-data.policy';
import {
  EmployeeProfessionalDataPatchService,
  ProfessionalEmployeeDataChanges,
} from '@modules/employees/domain/services/employee-professional-data-patch.service';
import {
  UpdateProfessionalEmployeeDataDto,
  UpdateProfessionalEmployeeDataResultDto,
} from '../dtos/update-professional-employee-data.dto';
import { EmployeeSnapshotMapper } from '../mappers/employee-snapshot.mapper';
import { LifecycleIntentMapper } from '../mappers/lifecycle-intent.mapper';
import { UpdateProfessionalEmployeeDataPort } from '../ports/inbound/update-professional-employee-data.port';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import {
  UpdateProfessionalEmployeeDataParams,
  UpdateProfessionalEmployeeDataRepositoryPort,
} from '../ports/outbound/update-professional-employee-data-repository.port';
import { resolveProfessionalEmployeeDataChanges } from '../services/professional-employee-data-changes.resolver';

export class UpdateProfessionalEmployeeDataUsecase implements UpdateProfessionalEmployeeDataPort {
  constructor(
    private readonly findEmployeeById: FindEmployeeByIdPort,
    private readonly professionalDataPolicy: EmployeeProfessionalDataPolicy,
    private readonly professionalDataPatchService: EmployeeProfessionalDataPatchService,
    private readonly lifecyclePolicy: EmployeeLifecyclePolicy,
    private readonly updateProfessionalDataRepository: UpdateProfessionalEmployeeDataRepositoryPort,
  ) {}

  async execute(
    params: UpdateProfessionalEmployeeDataDto,
  ): Promise<UpdateProfessionalEmployeeDataResultDto> {
    const { actorId, id, jobTitle, role, status } = params;

    if (!actorId?.trim()) throw new ActorAuthenticationFailedError();

    const actorSnapshot = await this.findEmployeeById.findById(actorId);
    if (!actorSnapshot) throw new ActorAuthenticationFailedError();

    const targetSnapshot = await this.findEmployeeById.findById(id);
    if (!targetSnapshot) throw new EmployeeNotFoundError();

    const actor = EmployeeSnapshotMapper.toEntity(actorSnapshot);
    const target = EmployeeSnapshotMapper.toEntity(targetSnapshot);

    const changes = resolveProfessionalEmployeeDataChanges({
      jobTitle,
      role,
      status,
    });

    let validatedRole: EmployeeModel.Role | undefined;
    let roleChange = false;
    if (Object.hasOwn(changes, 'role')) {
      if (!EmployeeModel.isRole(changes.role)) {
        throw new InvalidEmployeeRoleError(`Invalid role: "${changes.role}"`);
      }
      validatedRole = changes.role;
      roleChange = validatedRole !== target.role;
    }

    let operationalStatus: EmployeeModel.OperationalStatus | undefined;
    let statusChange = false;
    if (Object.hasOwn(changes, 'status')) {
      if (!EmployeeModel.isOperationalStatus(changes.status)) {
        throw new InvalidEmployeeStatusError(
          `Invalid status: "${changes.status}"`,
        );
      }
      operationalStatus = changes.status;
      statusChange = operationalStatus !== target.status;
    }

    await this.professionalDataPolicy.assertCan({ actor, target, roleChange });

    if (statusChange && operationalStatus) {
      const intent = LifecycleIntentMapper.toIntent(operationalStatus);
      await this.lifecyclePolicy.assertCan({ actor, target, intent });
    }

    const professionalChanges: ProfessionalEmployeeDataChanges = {};
    if ('jobTitle' in changes) {
      professionalChanges.jobTitle = changes.jobTitle ?? null;
    }
    if (Object.hasOwn(changes, 'role')) {
      professionalChanges.role = validatedRole;
    }

    const professionalPatch = this.professionalDataPatchService.apply(
      target,
      professionalChanges,
    );

    if (statusChange && operationalStatus) {
      this.applyTransition(target, operationalStatus);
    }

    const persistPatch: Omit<UpdateProfessionalEmployeeDataParams, 'id'> = {
      ...professionalPatch,
    };

    if (statusChange) {
      const { status: nextStatus, deactivateAt } = target.toJSON();
      persistPatch.status = nextStatus;
      persistPatch.deactivateAt = deactivateAt;
    }

    if (Object.keys(persistPatch).length === 0) {
      return { id };
    }

    await this.updateProfessionalDataRepository.updateProfessionalData({
      id,
      ...persistPatch,
    });

    return { id };
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
