import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';
import { EmployeeDocument } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';

/** Maps a lean Employee document to the auth-owned AuthenticatableUser snapshot. */
export function mapEmployeeDocumentToAuthenticatable(
  document: EmployeeDocument,
): AuthenticatableUser {
  return {
    id: String(document._id),
    name: document.name,
    email: document.email,
    passwordHash: document.password,
    isActive: document.isActive ?? true,
    role: document.role,
  };
}
