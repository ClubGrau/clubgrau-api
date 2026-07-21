/** Input do caso de uso CreateCustomer (entrada da application). */
export interface CreateCustomerDto {
  name: string;
  email: string;
  phone?: string | null;
  nif?: number | null;
}

/** Output do caso de uso CreateCustomer (saída da application). */
export interface CreateCustomerResultDto {
  id: string;
}
