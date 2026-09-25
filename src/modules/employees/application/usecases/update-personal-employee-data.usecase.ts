import {
  ActorAuthenticationFailedError,
  EmployeeNotFoundError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeePersonalDataPolicy } from '@modules/employees/domain/services/employee-personal-data.policy';
import { EmployeePersonalDataPatchService } from '@modules/employees/domain/services/employee-personal-data-patch.service';
import {
  UpdatePersonalEmployeeDataDto,
  UpdatePersonalEmployeeDataResultDto,
} from '../dtos/update-personal-employee-data.dto';
import { EmployeeSnapshotMapper } from '../mappers/employee-snapshot.mapper';
import { UpdatePersonalEmployeeDataPort } from '../ports/inbound/update-personal-employee-data.port';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';
import { UpdatePersonalEmployeeDataRepositoryPort } from '../ports/outbound/update-personal-employee-data-repository.port';
import { resolvePersonalEmployeeDataChanges } from '../services/personal-employee-data-changes.resolver';

export class UpdatePersonalEmployeeDataUsecase implements UpdatePersonalEmployeeDataPort {
  constructor(
    private readonly findEmployeeById: FindEmployeeByIdPort,
    private readonly personalDataPolicy: EmployeePersonalDataPolicy,
    private readonly personalDataPatchService: EmployeePersonalDataPatchService,
    private readonly updatePersonalDataRepository: UpdatePersonalEmployeeDataRepositoryPort,
  ) {}

  async execute(
    params: UpdatePersonalEmployeeDataDto,
  ): Promise<UpdatePersonalEmployeeDataResultDto> {
    const { actorId, id, gender, languages, emergencyContact, nif, address } =
      params;

    if (!actorId?.trim()) throw new ActorAuthenticationFailedError();

    const actorSnapshot = await this.findEmployeeById.findById(actorId);
    if (!actorSnapshot) throw new ActorAuthenticationFailedError();

    const targetSnapshot = await this.findEmployeeById.findById(id);
    if (!targetSnapshot) throw new EmployeeNotFoundError();

    const actor = EmployeeSnapshotMapper.toEntity(actorSnapshot);
    const target = EmployeeSnapshotMapper.toEntity(targetSnapshot);

    this.personalDataPolicy.assertCan({ actor, target });

    const changes = resolvePersonalEmployeeDataChanges({
      gender,
      languages,
      emergencyContact,
      nif,
      address,
    });
    const patch = this.personalDataPatchService.apply(target, changes);

    await this.updatePersonalDataRepository.updatePersonalData({
      id,
      ...patch,
    });

    return { id };
  }
}
