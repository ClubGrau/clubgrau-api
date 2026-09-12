import { AuthenticatableUser } from './authenticatable-user.model';

/**
 * Claims presentes no JWT após o login.
 * Sem passwordHash — nunca deve existir no token.
 */
export type TokenPayload = Omit<
  AuthenticatableUser,
  'passwordHash' | 'loginCapable'
>;
