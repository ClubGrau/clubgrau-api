import { IndicationOriginInterval } from '@modules/indications/domain/models/indication-origin.model';

export interface UpdateIndicationOriginIntervalsParams {
  id: string;
  intervals: IndicationOriginInterval[];
}

export interface UpdateIndicationOriginIntervalsRepositoryPort {
  updateIntervals(params: UpdateIndicationOriginIntervalsParams): Promise<void>;
}
