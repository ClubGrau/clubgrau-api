/**
 * Request HTTP do PATCH professional-data (body bruto + path param :id).
 * jobTitle / role / status chegam como string | null via adaptRoute;
 * presença esparsa e normalização para UpdateProfessionalEmployeeDataDto no controller.
 * actorId / actorRole são injetados pelo adaptRoute — nunca confiados do body.
 * :id vem do path param (adaptRoute mescla params após body).
 * password é recusado na hora; employmentId é ignorado e não conta como campo.
 */
export type UpdateProfessionalEmployeeDataRequest = {
  id?: string;
  actorId?: string;
  actorRole?: string;
  jobTitle?: string | null;
  role?: string | null;
  status?: string | null;
  password?: unknown;
  employmentId?: unknown;
};
