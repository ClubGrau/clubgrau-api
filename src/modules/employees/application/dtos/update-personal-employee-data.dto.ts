/** Input do caso de uso UpdatePersonalEmployeeData (entrada da application). */
export interface UpdatePersonalEmployeeDataDtoInput {
  actorId: string;
  id: string;
  gender?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  nif?: string | null;
  address?: string | null;
}

/** Output do caso de uso UpdatePersonalEmployeeData (saída da application). */
export interface UpdatePersonalEmployeeDataResultDto {
  id: string;
}

export class UpdatePersonalEmployeeDataDto {
  readonly actorId: string;
  readonly id: string;
  readonly gender?: string | null;
  readonly languages?: string | null;
  readonly emergencyContact?: string | null;
  readonly nif?: string | null;
  readonly address?: string | null;

  constructor(data: UpdatePersonalEmployeeDataDtoInput) {
    this.actorId = data.actorId.trim();
    this.id = data.id.trim();

    // TODO melhorar regra de propagraçao da entrada de dado.
    if ('gender' in data) {
      this.gender = data.gender === null ? null : data.gender;
    }

    if ('languages' in data) {
      this.languages = data.languages === null ? null : data.languages;
    }

    if ('emergencyContact' in data) {
      this.emergencyContact =
        data.emergencyContact === null ? null : data.emergencyContact;
    }

    if ('nif' in data) {
      this.nif = data.nif === null ? null : data.nif;
    }

    if ('address' in data) {
      this.address = data.address === null ? null : data.address;
    }
  }
}
