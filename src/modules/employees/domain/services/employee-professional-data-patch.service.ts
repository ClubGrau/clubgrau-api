import { Employee } from '../entities/Employee';
import { EmployeeModel } from '../models/employee.model';

export type ProfessionalEmployeeDataField = 'jobTitle' | 'role';

export type ProfessionalEmployeeDataChanges = {
  jobTitle?: string | null;
  role?: EmployeeModel.Role;
};

export type ProfessionalEmployeeDataPersistPatch = {
  jobTitle?: string | null;
  role?: EmployeeModel.Role;
};

export class EmployeeProfessionalDataPatchService {
  apply(
    target: Employee,
    changes: ProfessionalEmployeeDataChanges,
  ): ProfessionalEmployeeDataPersistPatch {
    const patch: ProfessionalEmployeeDataPersistPatch = {};

    if ('jobTitle' in changes) {
      const jobTitle = this.normalizeJobTitle(changes.jobTitle ?? null);
      target.changeJobTitle(jobTitle);
      patch.jobTitle = jobTitle;
    }

    if ('role' in changes && changes.role !== target.role) {
      target.changeRole(changes.role as EmployeeModel.Role);
      patch.role = changes.role;
    }

    return patch;
  }

  private normalizeJobTitle(value: string | null): string | null {
    if (value === null || value.trim() === '') {
      return null;
    }

    return value;
  }
}
