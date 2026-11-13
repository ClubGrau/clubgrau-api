/**
 * Request HTTP da remoção de customer (body bruto).
 * id/password chegam sem validação tipada; a normalização ocorre no controller.
 * actorId é injetado pelo adaptRoute — nunca confiado do body.
 */
export interface RemoveCustomerRequest {
  id?: unknown;
  password?: unknown;
  actorId?: string;
}
