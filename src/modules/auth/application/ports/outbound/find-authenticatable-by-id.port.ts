import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';

export interface FindAuthenticatableByIdPort {
  findAuthenticatableById(id: string): Promise<AuthenticatableUser | null>;
}
