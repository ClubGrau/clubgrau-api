import { ActorAuthenticationFailedError } from '@modules/employees/domain/errors/employee.errors';
import { EmployeeOwnDataPatchService } from '@modules/employees/domain/services/employee-own-data-patch.service';
import { EmployeeOwnDataPolicy } from '@modules/employees/domain/services/employee-own-data.policy';
import { GetEmployeesItemDto } from '../dtos/get-employees.dto';
import { UpdateOwnEmployeeDataDto } from '../dtos/update-own-employee-data.dto';
import { EmployeeSnapshotMapper } from '../mappers/employee-snapshot.mapper';
import { UpdateOwnEmployeeDataPort } from '../ports/inbound/update-own-employee-data.port';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { FindOwnEmployeePort } from '../ports/outbound/find-own-employee.port';
import { UpdateOwnEmployeeDataRepositoryPort } from '../ports/outbound/update-own-employee-data-repository.port';
import { resolveOwnEmployeeDataChanges } from '../services/own-employee-data-changes.resolver';

export class UpdateOwnEmployeeDataUsecase implements UpdateOwnEmployeeDataPort {
  constructor(
    private readonly findEmployeeById: FindEmployeeByIdPort,
    private readonly ownDataPolicy: EmployeeOwnDataPolicy,
    private readonly ownDataPatchService: EmployeeOwnDataPatchService,
    private readonly updateOwnDataRepository: UpdateOwnEmployeeDataRepositoryPort,
    private readonly findOwnEmployee: FindOwnEmployeePort,
  ) {}

  async execute(
    params: UpdateOwnEmployeeDataDto,
  ): Promise<GetEmployeesItemDto> {
    const {
      actorId,
      name,
      phone,
      username,
      gender,
      languages,
      emergencyContact,
      nif,
      address,
    } = params;

    if (!actorId?.trim()) throw new ActorAuthenticationFailedError();

    const actorSnapshot = await this.findEmployeeById.findById(actorId);
    if (!actorSnapshot) throw new ActorAuthenticationFailedError();

    const actor = EmployeeSnapshotMapper.toEntity(actorSnapshot);

    this.ownDataPolicy.assertCan(actor.status);

    const changes = resolveOwnEmployeeDataChanges({
      name,
      phone,
      username,
      gender,
      languages,
      emergencyContact,
      nif,
      address,
    });
    const patch = this.ownDataPatchService.apply(actor, changes);

    await this.updateOwnDataRepository.updateOwnData({
      id: actorId,
      ...patch,
    });

    const readModel = await this.findOwnEmployee.findOwnEmployee(actorId);
    if (!readModel) {
      throw new Error('Own employee read model missing after update');
    }

    return readModel;
  }
}
