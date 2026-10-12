import { IndicationOriginNotFoundError } from '@modules/indications/domain/errors/indication.errors';
import { IndicationOriginNamePolicy } from '@modules/indications/domain/services/indication-origin-name.policy';
import {
  CorrectIndicationOriginNameDto,
  CorrectIndicationOriginNameResultDto,
} from '../dtos/correct-indication-origin-name.dto';
import { IndicationOriginSnapshotMapper } from '../mappers/indication-origin-snapshot.mapper';
import { CorrectIndicationOriginNamePort } from '../ports/inbound/correct-indication-origin-name.port';
import { FindIndicationOriginByIdPort } from '../ports/outbound/find-indication-origin-by-id.port';
import { UpdateIndicationOriginNameRepositoryPort } from '../ports/outbound/update-indication-origin-name-repository.port';

export class CorrectIndicationOriginNameUsecase implements CorrectIndicationOriginNamePort {
  constructor(
    private readonly namePolicy: IndicationOriginNamePolicy,
    private readonly findByIdRepository: FindIndicationOriginByIdPort,
    private readonly updateNameRepository: UpdateIndicationOriginNameRepositoryPort,
  ) {}

  async execute(
    params: CorrectIndicationOriginNameDto,
  ): Promise<CorrectIndicationOriginNameResultDto> {
    const { id, name } = params;

    const snapshot = await this.findByIdRepository.findById(id);
    if (snapshot === null) {
      throw new IndicationOriginNotFoundError();
    }

    const origin = IndicationOriginSnapshotMapper.toEntity(snapshot);

    if (origin.correctName(name) === false) {
      return { id };
    }

    await this.namePolicy.ensureAvailable({
      categoryId: origin.categoryId,
      nameKey: origin.nameKey,
      exceptOriginId: id,
    });

    await this.updateNameRepository.updateName({
      id,
      name: origin.name.value,
      nameKey: origin.nameKey,
    });

    return { id };
  }
}
