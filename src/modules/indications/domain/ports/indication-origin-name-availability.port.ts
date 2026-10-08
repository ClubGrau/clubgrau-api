import type { IndicationCategoryId } from '../indication-categories';

export type IndicationOriginNameAvailabilityQuery = {
  categoryId: IndicationCategoryId;
  nameKey: string;
  exceptOriginId?: string;
};

export interface IndicationOriginNameAvailabilityPort {
  existsByNameKey(
    input: IndicationOriginNameAvailabilityQuery,
  ): Promise<boolean>;
}
