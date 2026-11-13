/**
 * Request HTTP do PATCH customer (body bruto + path param :id).
 * Campos cadastrais chegam via adaptRoute; presença esparsa e normalização
 * para UpdateCustomerDto ocorrem no controller.
 * :id vem do path param (adaptRoute mescla params após body).
 */
export type UpdateCustomerRequest = {
  id?: string;
  actorId?: string;
  actorRole?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  nif?: string | number | null;
};
