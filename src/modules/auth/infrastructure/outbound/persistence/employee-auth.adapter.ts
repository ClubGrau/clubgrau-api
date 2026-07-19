import { FindAuthenticatableByEmailPort } from '@modules/auth/application/ports/outbound/find-authenticable-by-email.port';
import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';
import {
  EmployeeDocument,
  EmployeeMongooseModel,
} from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { mapEmployeeDocumentToAuthenticatable } from './employee-authenticatable.mapper';

export class EmployeeAuthAdapter implements FindAuthenticatableByEmailPort {
  constructor(private readonly employeeModel: EmployeeMongooseModel) {}

  async findAuthenticatableByEmail(
    email: string,
  ): Promise<AuthenticatableUser | null> {
    const employee = await this.employeeModel.findOne({ email }).lean();
    if (!employee) {
      return null;
    }

    return mapEmployeeDocumentToAuthenticatable(employee as EmployeeDocument);
  }
}
