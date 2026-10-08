import { IndicationOriginNameTakenError } from '../errors/indication.errors';
import type {
  IndicationOriginNameAvailabilityPort,
  IndicationOriginNameAvailabilityQuery,
} from '../ports/indication-origin-name-availability.port';

export class IndicationOriginNamePolicy {
  constructor(
    private readonly availability: IndicationOriginNameAvailabilityPort,
  ) {}

  async ensureAvailable(
    input: IndicationOriginNameAvailabilityQuery,
  ): Promise<void> {
    const query = {
      categoryId: input.categoryId,
      nameKey: input.nameKey,
      ...(input.exceptOriginId !== undefined
        ? { exceptOriginId: input.exceptOriginId }
        : {}),
    };

    const taken = await this.availability.existsByNameKey(query);

    if (taken) {
      throw new IndicationOriginNameTakenError();
    }
  }
}
