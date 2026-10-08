export type IndicationOriginCatalogRow = {
  id: string;
  categoryId: 'canal' | 'campanha';
  name: string;
  position: number;
  active: boolean;
};

export interface ListIndicationOriginsPort {
  list(): Promise<IndicationOriginCatalogRow[]>;
}
