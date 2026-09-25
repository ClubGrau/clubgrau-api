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

    if (data.gender !== undefined) {
      this.gender = data.gender;
    }

    if (data.languages !== undefined) {
      this.languages = data.languages;
    }

    if (data.emergencyContact !== undefined) {
      this.emergencyContact = data.emergencyContact;
    }

    if (data.nif !== undefined) {
      this.nif = data.nif;
    }

    if (data.address !== undefined) {
      this.address = data.address;
    }
  }
}
