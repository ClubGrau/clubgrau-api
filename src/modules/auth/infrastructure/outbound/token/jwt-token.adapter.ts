import envs from '@configs/envs';
import { LoginResultDto } from '@modules/auth/application/dtos/login.dto';
import { TokenProviderPort } from '@modules/auth/application/ports/outbound/token-provider.port';
import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';
import * as jwt from 'jsonwebtoken';

export class JwtTokenAdapter implements TokenProviderPort<AuthenticatableUser> {
  generateToken(payload: AuthenticatableUser): LoginResultDto {
    const secret = envs.jwtSecret;
    if (!secret) {
      throw new Error('JWT_SECRET is not set in environment variables');
    }

    const tokenPayload: AuthenticatableUser = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      isActive: payload.isActive,
    };
    const token = jwt.sign(tokenPayload, secret, {
      expiresIn: Number(envs.tokenExpirationTime),
    });
    return { token };
  }
}
