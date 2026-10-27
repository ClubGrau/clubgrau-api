export type LinkableIndicationOriginDto = {
  id: string;
  categoryId: 'canal' | 'campanha';
  name: string;
};

export interface GetLinkableIndicationOriginsResultDto {
  origins: LinkableIndicationOriginDto[];
}
