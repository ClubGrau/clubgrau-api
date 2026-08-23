/**
 * Request HTTP da remoção de employee (body bruto).
 * id/password chegam como string via adaptRoute; a normalização tipada
 * para RemoveEmployeeDto acontece no controller.
 * actorId é injetado pelo adaptRoute — nunca confiado do body.
 */
export type RemoveEmployeeRequest = {
  id?: string;
  password?: string;
  actorId?: string;
};
