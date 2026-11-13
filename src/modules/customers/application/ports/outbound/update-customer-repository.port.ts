export interface UpdateCustomerParams {
  id: string;
  name?: string;
  email?: string;
  phone?: string | null;
  nif?: string | null;
}

export interface UpdateCustomerRepositoryPort {
  /** `false` when the customer was already removed (or does not exist). */
  update(params: UpdateCustomerParams): Promise<boolean>;
}
