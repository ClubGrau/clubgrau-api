import envs from '@configs/envs';
import { LoginResultDto } from '@modules/auth/application/dtos/login.dto';
import { TokenDecoderPort } from '@modules/auth/application/ports/outbound/token-decoder.port';
import { TokenProviderPort } from '@modules/auth/application/ports/outbound/token-provider.port';
import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';
import { TokenPayload } from '@modules/auth/domain/models/token-payload.model';
import * as jwt from 'jsonwebtoken';

export class JwtTokenAdapter
  implements
    TokenProviderPort<AuthenticatableUser>,
    TokenDecoderPort<TokenPayload>
{
  generateToken(payload: AuthenticatableUser): LoginResultDto {
    const secret = this.getSecret();

    const tokenPayload: TokenPayload = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };
    const token = jwt.sign(tokenPayload, secret, {
      expiresIn: Number(envs.tokenExpirationTime),
    });
    return { token };
  }

  decode(token: string): TokenPayload {
    const secret = this.getSecret();
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === 'string') {
      throw new Error('Invalid token payload');
    }

    return {
      id: decoded.id as string,
      name: decoded.name as string,
      email: decoded.email as string,
      role: decoded.role as string,
      status: String(decoded.status ?? 'ACTIVE'),
    };
  }

  private getSecret(): string {
    const secret = envs.jwtSecret;
    if (!secret) {
      throw new Error('JWT_SECRET is not set in environment variables');
    }
    return secret;
  }
}
