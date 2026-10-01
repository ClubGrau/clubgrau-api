import { EmptyOwnEmployeeDataError } from '@modules/employees/domain/errors/employee.errors';
import {
  OwnEmployeeDataChanges,
  OwnEmployeeDataField,
} from '@modules/employees/domain/services/employee-own-data-patch.service';

export type OwnEmployeeDataInput = Partial<
  Record<OwnEmployeeDataField, string | null | undefined>
>;

export function resolveOwnEmployeeDataChanges(
  fields: OwnEmployeeDataInput,
): OwnEmployeeDataChanges {
  const changes = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as OwnEmployeeDataChanges;

  if (Object.keys(changes).length === 0) {
    throw new EmptyOwnEmployeeDataError();
  }

  return changes;
}
