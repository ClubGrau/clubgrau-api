import {
  ActorAuthenticationFailedError,
  EmployeeNotFoundError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeMainDataPolicy } from '@modules/employees/domain/services/employee-main-data.policy';
import { EmployeeMainDataPatchService } from '@modules/employees/domain/services/employee-main-data-patch.service';
import {
  UpdateMainEmployeeDataDto,
  UpdateMainEmployeeDataResultDto,
} from '../dtos/update-main-employee-data.dto';
import { EmployeeSnapshotMapper } from '../mappers/employee-snapshot.mapper';
import { resolveMainEmployeeDataChanges } from '../services/main-employee-data-changes.resolver';
import { UpdateMainEmployeeDataPort } from '../ports/inbound/update-main-employee-data.port';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { UpdateMainEmployeeDataRepositoryPort } from '../ports/outbound/update-main-employee-data-repository.port';

export class UpdateMainEmployeeDataUsecase implements UpdateMainEmployeeDataPort {
  constructor(
    private readonly findEmployeeById: FindEmployeeByIdPort,
    private readonly mainDataPatchService: EmployeeMainDataPatchService,
    private readonly mainDataPolicy: EmployeeMainDataPolicy,
    private readonly updateMainDataRepository: UpdateMainEmployeeDataRepositoryPort,
  ) {}

  async execute(
    params: UpdateMainEmployeeDataDto,
  ): Promise<UpdateMainEmployeeDataResultDto> {
    const { actorId, id, name, email, phone, username } = params;

    if (!actorId?.trim()) throw new ActorAuthenticationFailedError();

    const actorSnapshot = await this.findEmployeeById.findById(actorId);
    if (!actorSnapshot) throw new ActorAuthenticationFailedError();

    const targetSnapshot = await this.findEmployeeById.findById(id);
    if (!targetSnapshot) throw new EmployeeNotFoundError();

    const actor = EmployeeSnapshotMapper.toEntity(actorSnapshot);
    const target = EmployeeSnapshotMapper.toEntity(targetSnapshot);

    this.mainDataPolicy.assertCan({ actor, target });

    const changes = resolveMainEmployeeDataChanges({
      name,
      email,
      phone,
      username,
    });
    const patch = await this.mainDataPatchService.apply(target, changes);

    await this.updateMainDataRepository.updateMainData({ id, ...patch });

    return { id };
  }
}
