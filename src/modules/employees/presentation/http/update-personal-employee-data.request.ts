/**
 * Request HTTP do PATCH personal-data (body bruto + path param :id).
 * Campos pessoais chegam como string | null (ou number em `nif`) via adaptRoute;
 * presença esparsa e normalização para UpdatePersonalEmployeeDataDto no controller.
 * actorId / actorRole são injetados pelo adaptRoute — nunca confiados do body.
 * :id vem do path param (adaptRoute mescla params após body).
 */
export type UpdatePersonalEmployeeDataRequest = {
  id?: string;
  actorId?: string;
  actorRole?: string;
  gender?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  nif?: string | number | null;
  address?: string | null;
};
