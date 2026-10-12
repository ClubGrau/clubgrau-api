export type IndicationCatalogOriginDto = {
  id: string;
  categoryId: 'canal' | 'campanha';
  name: string;
  active: boolean;
};

export type IndicationCatalogCategoryDto = {
  id: 'canal' | 'campanha' | 'amigo';
  name: 'Canal' | 'Campanha' | 'Amigo';
  holdsOrigins: boolean;
  origins: IndicationCatalogOriginDto[];
};

export type GetIndicationCatalogResultDto = {
  categories: IndicationCatalogCategoryDto[];
};
