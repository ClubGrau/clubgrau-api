import {
  InvalidNameError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { Employee } from '../entities/Employee';
import {
  EmployeePersonalDataPatchService,
  PersonalEmployeeDataChanges,
} from './employee-personal-data-patch.service';

export type OwnEmployeeDataField =
  | 'name'
  | 'phone'
  | 'username'
  | 'gender'
  | 'languages'
  | 'emergencyContact'
  | 'nif'
  | 'address';

export type OwnEmployeeDataChanges = Partial<
  Record<OwnEmployeeDataField, string | null>
>;

export type OwnEmployeeDataPersistPatch = {
  name?: string;
  phone?: string;
  username?: string | null;
  gender?: string | null;
  languages?: string | null;
  emergencyContact?: string | null;
  nif?: string | null;
  address?: string | null;
};

const PERSONAL_FIELDS = [
  'gender',
  'languages',
  'emergencyContact',
  'nif',
  'address',
] as const satisfies readonly (keyof PersonalEmployeeDataChanges)[];

export class EmployeeOwnDataPatchService {
  constructor(
    private readonly personalPatchService: EmployeePersonalDataPatchService,
  ) {}

  apply(
    actor: Employee,
    changes: OwnEmployeeDataChanges,
  ): OwnEmployeeDataPersistPatch {
    const patch: OwnEmployeeDataPersistPatch = {};

    if ('name' in changes) {
      const name = changes.name;

      if (typeof name !== 'string') {
        throw new InvalidNameError('Name is required');
      }

      patch.name = actor.patchName(name);
    }

    if ('phone' in changes) {
      const phone = changes.phone;

      if (typeof phone !== 'string') {
        throw new InvalidPhoneFormatError('Phone is required');
      }

      patch.phone = actor.patchPhone(phone);
    }

    if ('username' in changes) {
      patch.username = actor.patchUsername(changes.username ?? null);
    }

    const personalChanges = this.pickPersonalChanges(changes);

    if (Object.keys(personalChanges).length > 0) {
      Object.assign(
        patch,
        this.personalPatchService.apply(actor, personalChanges),
      );
    }

    return patch;
  }

  private pickPersonalChanges(
    changes: OwnEmployeeDataChanges,
  ): PersonalEmployeeDataChanges {
    const personalChanges: PersonalEmployeeDataChanges = {};

    for (const field of PERSONAL_FIELDS) {
      if (field in changes) {
        personalChanges[field] = changes[field] ?? null;
      }
    }

    return personalChanges;
  }
}
