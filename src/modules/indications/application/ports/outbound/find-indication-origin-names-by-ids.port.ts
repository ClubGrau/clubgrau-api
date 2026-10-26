export type IndicationOriginNameReadModel = {
  id: string;
  name: string;
};

/** Driven port: nomes de origens em lote (sem reconstituição). */
export interface FindIndicationOriginNamesByIdsPort {
  findOriginNamesByIds(ids: string[]): Promise<IndicationOriginNameReadModel[]>;
}
