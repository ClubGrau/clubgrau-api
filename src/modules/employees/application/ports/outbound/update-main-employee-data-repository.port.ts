export interface UpdateMainEmployeeDataParams {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  username?: string | null;
}

export interface UpdateMainEmployeeDataRepositoryPort {
  updateMainData(params: UpdateMainEmployeeDataParams): Promise<void>;
}
