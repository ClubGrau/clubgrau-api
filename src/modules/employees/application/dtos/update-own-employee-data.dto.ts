/** Input do caso de uso UpdateOwnEmployeeData (entrada da application). */
export interface UpdateOwnEmployeeDataDtoInput {
  actorId: string;
  name?: string;
  phone?: string;
  username?: string | null;
  gender?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  nif?: string | null;
  address?: string | null;
}

export class UpdateOwnEmployeeDataDto {
  readonly actorId: string | undefined;
  readonly name?: string;
  readonly phone?: string;
  readonly username?: string | null;
  readonly gender?: string | null;
  readonly languages?: string | null;
  readonly emergencyContact?: string | null;
  readonly nif?: string | null;
  readonly address?: string | null;

  constructor(data: UpdateOwnEmployeeDataDtoInput) {
    Object.assign(
      this,
      Object.fromEntries(
        Object.entries(data).filter(
          ([key, value]) => key === 'actorId' || value !== undefined,
        ),
      ),
    );
  }
}
