export type UpdateOwnEmployeeDataRequest = {
  actorId?: string;
  actorRole?: string;
  id?: string;
  name?: string | null;
  phone?: string | null;
  username?: string | null;
  gender?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  nif?: string | number | null;
  address?: string | null;
};
