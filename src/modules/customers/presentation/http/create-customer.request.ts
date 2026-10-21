export type CreateCustomerRequest = {
  name: string;
  email: string;
  phone?: string | null;
  nif?: number | null;
  indication?: {
    categoryId: string;
    originId?: string | null;
    referrerCustomerId?: string | null;
  } | null;
};
