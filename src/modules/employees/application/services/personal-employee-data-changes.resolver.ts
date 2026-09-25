import { EmptyPersonalEmployeeDataError } from '@modules/employees/domain/errors/employee.errors';
import {
  PersonalEmployeeDataChanges,
  PersonalEmployeeDataField,
} from '@modules/employees/domain/services/employee-personal-data-patch.service';

export type PersonalEmployeeDataInput = Partial<
  Record<PersonalEmployeeDataField, string | null | undefined>
>;

export function resolvePersonalEmployeeDataChanges(
  fields: PersonalEmployeeDataInput,
): PersonalEmployeeDataChanges {
  const changes = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as PersonalEmployeeDataChanges;

  if (Object.keys(changes).length === 0) {
    throw new EmptyPersonalEmployeeDataError();
  }

  return changes;
}
