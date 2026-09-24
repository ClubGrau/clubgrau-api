import { Nif, Phone } from '@shared/domain/value-object';
import { Employee } from '../entities/Employee';
import { InvalidEmployeeGenderError } from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';

export type PersonalEmployeeDataField =
  'gender' | 'languages' | 'emergencyContact' | 'nif' | 'address';

export type PersonalEmployeeDataChanges = Partial<
  Record<PersonalEmployeeDataField, string | null>
>;

export type PersonalEmployeeDataPersistPatch = Partial<
  Record<PersonalEmployeeDataField, string | null>
>;

export class EmployeePersonalDataPatchService {
  apply(
    target: Employee,
    changes: PersonalEmployeeDataChanges,
  ): PersonalEmployeeDataPersistPatch {
    const patch: PersonalEmployeeDataPersistPatch = {};

    if ('gender' in changes) {
      patch.gender = this.applyGender(target, changes.gender ?? null);
    }

    if ('languages' in changes) {
      patch.languages = this.applyNullableField(
        changes.languages ?? null,
        (value) => target.assignLanguages(value),
      );
    }

    if ('address' in changes) {
      patch.address = this.applyNullableField(
        changes.address ?? null,
        (value) => target.assignAddress(value),
      );
    }

    if ('emergencyContact' in changes) {
      patch.emergencyContact = this.applyEmergencyContact(
        target,
        changes.emergencyContact ?? null,
      );
    }

    if ('nif' in changes) {
      patch.nif = this.applyNif(target, changes.nif ?? null);
    }

    return patch;
  }

  private applyGender(target: Employee, value: string | null) {
    if (Object.is(value, null)) {
      target.assignGender(null);
      return null;
    }

    if (!EmployeeModel.isGender(value)) throw new InvalidEmployeeGenderError();

    target.assignGender(value);
    return value;
  }

  private applyEmergencyContact(
    target: Employee,
    value: string | null,
  ): string | null {
    if (Object.is(value, null)) {
      target.assignEmergencyContact(null);
      return null;
    }

    const phone = value ? Phone.create(value) : null;
    target.assignEmergencyContact(phone);

    return phone?.value ?? null;
  }

  private applyNif(target: Employee, value: string | null): string | null {
    if (Object.is(value, null)) {
      target.assignNif(null);
      return null;
    }

    const nif = value ? Nif.create(value) : null;
    target.assignNif(nif);

    return nif?.value ?? null;
  }

  private applyNullableField(
    value: string | null,
    assign: (value: string | null) => void,
  ): string | null {
    if (Object.is(value, null)) {
      assign(null);
      return null;
    }

    assign(value);
    return value;
  }
}
