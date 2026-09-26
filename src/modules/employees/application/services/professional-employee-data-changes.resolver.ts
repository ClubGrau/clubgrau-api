import { EmptyProfessionalEmployeeDataError } from '@modules/employees/domain/errors/employee.errors';

export type ProfessionalEmployeeDataInput = {
  jobTitle?: string | null | undefined;
  role?: string | undefined;
  status?: string | undefined;
};

export type ResolvedProfessionalEmployeeDataChanges = {
  jobTitle?: string | null;
  role?: string;
  status?: string;
};

export function resolveProfessionalEmployeeDataChanges(
  fields: ProfessionalEmployeeDataInput,
): ResolvedProfessionalEmployeeDataChanges {
  const changes = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as ResolvedProfessionalEmployeeDataChanges;

  if (Object.keys(changes).length === 0) {
    throw new EmptyProfessionalEmployeeDataError();
  }

  return changes;
}
