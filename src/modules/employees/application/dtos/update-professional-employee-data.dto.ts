/** Input do caso de uso UpdateProfessionalEmployeeData (entrada da application). */
export interface UpdateProfessionalEmployeeDataDtoInput {
  actorId: string;
  id: string;
  jobTitle?: string | null;
  role?: string;
  status?: string;
}

/** Output do caso de uso UpdateProfessionalEmployeeData (saída da application). */
export interface UpdateProfessionalEmployeeDataResultDto {
  id: string;
}

export class UpdateProfessionalEmployeeDataDto {
  readonly actorId: string;
  readonly id: string;
  readonly jobTitle?: string | null;
  readonly role?: string;
  readonly status?: string;

  constructor(data: UpdateProfessionalEmployeeDataDtoInput) {
    this.actorId = data.actorId.trim();
    this.id = data.id.trim();

    if ('jobTitle' in data) {
      this.jobTitle = data.jobTitle;
    }

    if ('role' in data) {
      this.role = data.role;
    }

    if ('status' in data) {
      this.status = data.status;
    }
  }
}
