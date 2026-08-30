/**
 * Request HTTP da criação de employee (body bruto).
 * nif pode chegar como string do frontend; a conversão para number
 * e o descarte de `status` acontecem no controller.
 */
export type CreateEmployeeRequest = {
  name?: string;
  email?: string;
  role?: string;
  phone?: string | null;
  nif?: string | number | null;
  password?: string;
  passwordConfirmation?: string;
  status?: string;
  username?: string | null;
  gender?: string | null;
  address?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  employmentId?: string | null;
  jobTitle?: string | null;
};
