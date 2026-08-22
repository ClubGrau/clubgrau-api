import { EmployeeModel } from '@modules/employees/domain/models/employee.model';

export interface AnonymizeEmployeeParams {
  id: string;
  name: string;
  email: string;
  phone: null;
  nif: null;
  password: string;
  status: typeof EmployeeModel.Status.REMOVED;
  removedAt: Date;
}

export interface AnonymizeEmployeeRepositoryPort {
  anonymize(params: AnonymizeEmployeeParams): Promise<void>;
}
