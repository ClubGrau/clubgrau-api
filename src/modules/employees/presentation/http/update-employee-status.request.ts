/**
 * Request HTTP da atualização de status (body bruto).
 * status chega como string via adaptRoute; a normalização tipada
 * para UpdateEmployeeStatusDto acontece no controller.
 * actorId é injetado pelo adaptRoute — nunca confiado do body.
 */
export type UpdateEmployeeStatusRequest = {
  id?: string;
  status?: string;
  actorId?: string;
};
