/** Input do caso de uso UpdateMainEmployeeData (entrada da application). */
export interface UpdateMainEmployeeDataDto {
  /** Stampado pelo adaptRoute a partir do JWT; nunca do body do cliente. */
  actorId: string;
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  /** Presente + blank/null → clear. */
  username?: string | null;
}

/** Output do caso de uso UpdateMainEmployeeData (saída da application). */
export interface UpdateMainEmployeeDataResultDto {
  id: string;
}
