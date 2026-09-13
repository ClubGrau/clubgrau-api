import { Email } from '@shared/domain/value-object';
import { Employee } from '../entities/Employee';
import { EmployeePoliciesService } from './employee-policies.service';

export type MainEmployeeDataField = 'name' | 'email' | 'phone' | 'username';

export type MainEmployeeDataChanges = Partial<
  Record<MainEmployeeDataField, string | null>
>;

export type MainEmployeeDataPersistPatch = {
  name?: string;
  email?: string;
  phone?: string;
  username?: string | null;
};

export class EmployeeMainDataPatchService {
  constructor(
    private readonly employeePoliciesService: EmployeePoliciesService,
  ) {}

  async apply(
    target: Employee,
    changes: MainEmployeeDataChanges,
  ): Promise<MainEmployeeDataPersistPatch> {
    const patch: MainEmployeeDataPersistPatch = {};

    if (changes.name) {
      patch.name = target.patchName(changes.name);
    }

    if (changes.email) {
      patch.email = await this.patchEmail(target, changes.email);
    }

    if (changes.phone) {
      patch.phone = target.patchPhone(changes.phone);
    }

    if (changes.username !== undefined) {
      patch.username = target.patchUsername(changes.username);
    }

    return patch;
  }

  private async patchEmail(target: Employee, raw: string): Promise<string> {
    const email = Email.create(raw);

    if (email.value !== target.email.value) {
      await this.employeePoliciesService.ensureEmailIsAvailable(email.value);
    }

    target.changeEmail(email);
    return email.value;
  }
}
