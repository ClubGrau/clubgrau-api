export interface UpdateIndicationOriginNameParams {
  id: string;
  name: string;
  nameKey: string;
}

export interface UpdateIndicationOriginNameRepositoryPort {
  updateName(params: UpdateIndicationOriginNameParams): Promise<void>;
}
