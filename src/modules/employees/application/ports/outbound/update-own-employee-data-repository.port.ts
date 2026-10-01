export interface UpdateOwnEmployeeDataParams {
  id: string;
  name?: string;
  phone?: string;
  username?: string | null;
  gender?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  nif?: string | null;
  address?: string | null;
}

export interface UpdateOwnEmployeeDataRepositoryPort {
  updateOwnData(params: UpdateOwnEmployeeDataParams): Promise<void>;
}
