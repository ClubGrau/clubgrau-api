/**
 * Request HTTP do PATCH main-data (body bruto + path param :id).
 * Campos Main Data chegam como string via adaptRoute; a normalização tipada
 * para UpdateMainEmployeeDataDto acontece no controller.
 * actorId é injetado pelo adaptRoute — nunca confiado do body.
 * :id vem do path param (adaptRoute mescla params após body).
 */
export type UpdateMainEmployeeDataRequest = {
  id?: string;
  actorId?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  status?: unknown;
  password?: unknown;
};
