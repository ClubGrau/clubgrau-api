import { IndicationOrigin } from '@modules/indications/domain/entities/IndicationOrigin';
import { IndicationCategories } from '@modules/indications/domain/indication-categories';
import { IndicationOriginNamePolicy } from '@modules/indications/domain/services/indication-origin-name.policy';
import {
  CreateIndicationOriginDto,
  CreateIndicationOriginResultDto,
} from '../dtos/create-indication-origin.dto';
import { CreateIndicationOriginPort } from '../ports/inbound/create-indication-origin.port';
import { InsertIndicationOriginRepositoryPort } from '../ports/outbound/insert-indication-origin-repository.port';
import { NextIndicationOriginPositionPort } from '../ports/outbound/next-indication-origin-position.port';

export class CreateIndicationOriginUsecase implements CreateIndicationOriginPort {
  constructor(
    private readonly namePolicy: IndicationOriginNamePolicy,
    private readonly nextPosition: NextIndicationOriginPositionPort,
    private readonly insertIndicationOriginRepository: InsertIndicationOriginRepositoryPort,
  ) {}

  async execute(
    params: CreateIndicationOriginDto,
  ): Promise<CreateIndicationOriginResultDto> {
    const { categoryId, name } = params;

    const category = IndicationCategories.requireHoldingOrigins(categoryId);

    const nameKey = IndicationOrigin.nameKeyFrom(name);

    await this.namePolicy.ensureAvailable({
      categoryId: category.id,
      nameKey,
    });

    const position = await this.nextPosition.nextPosition(category.id);

    const origin = IndicationOrigin.create({
      categoryId: category.id,
      name,
      position,
    }).toJSON();

    await this.insertIndicationOriginRepository.insert(origin);

    return { id: origin.id };
  }
}
