/** Indicação opcional na criação do cliente (entrada da application). */
export interface CreateCustomerIndicationDto {
  categoryId: string;
  originId?: string | null;
  referrerCustomerId?: string | null;
}

/** Input do caso de uso CreateCustomer (entrada da application). */
export interface CreateCustomerDto {
  name: string;
  email: string;
  phone?: string | null;
  nif?: number | null;
  indication?: CreateCustomerIndicationDto | null;
}

/** Output do caso de uso CreateCustomer (saída da application). */
export interface CreateCustomerResultDto {
  id: string;
}
