export interface UpdatePersonalEmployeeDataParams {
  id: string;
  gender?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  nif?: string | null;
  address?: string | null;
}

export interface UpdatePersonalEmployeeDataRepositoryPort {
  updatePersonalData(params: UpdatePersonalEmployeeDataParams): Promise<void>;
}
