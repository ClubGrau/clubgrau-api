import { EmptyMainEmployeeDataError } from '@modules/employees/domain/errors/employee.errors';
import {
  MainEmployeeDataChanges,
  MainEmployeeDataField,
} from '@modules/employees/domain/services/employee-main-data-patch.service';

export type MainEmployeeDataInput = Partial<
  Record<MainEmployeeDataField, string | null | undefined>
>;

export function resolveMainEmployeeDataChanges(
  fields: MainEmployeeDataInput,
): MainEmployeeDataChanges {
  const changes = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as MainEmployeeDataChanges;

  if (Object.keys(changes).length === 0) {
    throw new EmptyMainEmployeeDataError();
  }

  return changes;
}
