/**
 * Request HTTP da atualização de status (body bruto).
 * status chega como string via adaptRoute; a normalização tipada
 * para UpdateEmployeeStatusDto acontece no controller.
 */
export type UpdateEmployeeStatusRequest = {
  id?: string;
  status?: string;
};
