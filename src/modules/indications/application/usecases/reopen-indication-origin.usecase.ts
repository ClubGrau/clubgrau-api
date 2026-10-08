import { IndicationOriginNotFoundError } from '@modules/indications/domain/errors/indication.errors';
import {
  ReopenIndicationOriginDto,
  ReopenIndicationOriginResultDto,
} from '../dtos/reopen-indication-origin.dto';
import { IndicationOriginSnapshotMapper } from '../mappers/indication-origin-snapshot.mapper';
import { ReopenIndicationOriginPort } from '../ports/inbound/reopen-indication-origin.port';
import { FindIndicationOriginByIdPort } from '../ports/outbound/find-indication-origin-by-id.port';
import { UpdateIndicationOriginIntervalsRepositoryPort } from '../ports/outbound/update-indication-origin-intervals-repository.port';

export class ReopenIndicationOriginUsecase implements ReopenIndicationOriginPort {
  constructor(
    private readonly findByIdRepository: FindIndicationOriginByIdPort,
    private readonly updateIntervals: UpdateIndicationOriginIntervalsRepositoryPort,
  ) {}

  async execute(
    params: ReopenIndicationOriginDto,
  ): Promise<ReopenIndicationOriginResultDto> {
    const { id } = params;

    const snapshot = await this.findByIdRepository.findById(id);
    if (snapshot === null) {
      throw new IndicationOriginNotFoundError();
    }

    const origin = IndicationOriginSnapshotMapper.toEntity(snapshot);

    if (origin.reopen() === false) {
      return { id };
    }

    await this.updateIntervals.updateIntervals({
      id,
      intervals: origin.intervals,
    });

    return { id };
  }
}
