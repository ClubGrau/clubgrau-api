import { IndicationOriginNotFoundError } from '@modules/indications/domain/errors/indication.errors';
import {
  EndIndicationOriginDto,
  EndIndicationOriginResultDto,
} from '../dtos/end-indication-origin.dto';
import { IndicationOriginSnapshotMapper } from '../mappers/indication-origin-snapshot.mapper';
import { EndIndicationOriginPort } from '../ports/inbound/end-indication-origin.port';
import { FindIndicationOriginByIdPort } from '../ports/outbound/find-indication-origin-by-id.port';
import { UpdateIndicationOriginIntervalsRepositoryPort } from '../ports/outbound/update-indication-origin-intervals-repository.port';

export class EndIndicationOriginUsecase implements EndIndicationOriginPort {
  constructor(
    private readonly findByIdRepository: FindIndicationOriginByIdPort,
    private readonly updateIntervals: UpdateIndicationOriginIntervalsRepositoryPort,
  ) {}

  async execute(
    params: EndIndicationOriginDto,
  ): Promise<EndIndicationOriginResultDto> {
    const { id } = params;

    const snapshot = await this.findByIdRepository.findById(id);
    if (snapshot === null) {
      throw new IndicationOriginNotFoundError();
    }

    const origin = IndicationOriginSnapshotMapper.toEntity(snapshot);

    if (origin.end() === false) {
      return { id };
    }

    await this.updateIntervals.updateIntervals({
      id,
      intervals: origin.intervals,
    });

    return { id };
  }
}
