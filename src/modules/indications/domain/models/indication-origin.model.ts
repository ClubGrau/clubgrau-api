import type { IndicationOrigin } from '../entities/IndicationOrigin';

export type IndicationOriginInterval = {
  from: Date;
  to: Date | null;
};

/** Snapshot serializado da entidade (persistência / ports de saída). */
export type IndicationOriginSnapshot = ReturnType<IndicationOrigin['toJSON']>;
