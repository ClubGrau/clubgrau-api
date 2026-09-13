/** Input do caso de uso UpdateMainEmployeeData (entrada da application). */
export interface UpdateMainEmployeeDataDtoInput {
  actorId: string;
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  username?: string | null;
}

/** Output do caso de uso UpdateMainEmployeeData (saída da application). */
export interface UpdateMainEmployeeDataResultDto {
  id: string;
}

export class UpdateMainEmployeeDataDto {
  readonly actorId: string;
  readonly id: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly username?: string | null;

  constructor(data: UpdateMainEmployeeDataDtoInput) {
    this.actorId = data.actorId.trim();
    this.id = data.id.trim();

    if (data.name) {
      this.name = data.name.trim();
    }

    if (data.email) {
      this.email = data.email.trim();
    }

    if (data.phone) {
      this.phone = data.phone.trim();
    }

    // TODO melhorar regra de propagraçao da entrada de dado.
    if (data.username !== undefined) {
      if (data.username === null) {
        this.username = null;
      } else {
        const trimmed = data.username.trim();
        this.username = trimmed === '' ? null : trimmed;
      }
    }
  }
}
