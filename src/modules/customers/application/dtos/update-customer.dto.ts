/** Input do caso de uso UpdateCustomer (entrada da application). */
export interface UpdateCustomerDto {
  id: string;
  name?: string;
  email?: string;
  phone?: string | null;
  nif?: string | null;
}

/** Output do caso de uso UpdateCustomer (saída da application). */
export interface UpdateCustomerResultDto {
  id: string;
}
