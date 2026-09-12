import * as jwt from 'jsonwebtoken';
import { TokenPayload } from '@modules/auth/domain/models/token-payload.model';
import { JwtTokenAdapter } from './jwt-token.adapter';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('valid_token'),
  verify: jest.fn(),
}));

jest.mock('@configs/envs', () => ({
  __esModule: true,
  default: {
    jwtSecret: 'any_secret',
    tokenExpirationTime: '30',
  },
}));

const makeTokenPayload = (overrides?: Partial<TokenPayload>): TokenPayload => ({
  id: 'any_id',
  name: 'any_name',
  email: 'any_email@mail.com',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  sessionVersion: 0,
  ...overrides,
});

const makeSut = () => {
  const sut = new JwtTokenAdapter();
  return { sut };
};

describe('JwtTokenAdapter', () => {
  describe('generateToken', () => {
    it('should be defined', () => {
      const { sut } = makeSut();
      expect(sut).toBeDefined();
      expect(sut).toBeInstanceOf(JwtTokenAdapter);
    });

    it('should call jwt.sign with payload, secret and TOKEN_EXPIRATION_TIME', () => {
      const { sut } = makeSut();
      const signSpy = jest.spyOn(jwt, 'sign');
      const payload = makeTokenPayload({ sessionVersion: 3 });

      const { token } = sut.generateToken(payload);

      expect(signSpy).toHaveBeenCalledWith(
        {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          status: payload.status,
          sessionVersion: 3,
        },
        'any_secret',
        { expiresIn: 30 },
      );
      expect(token).toBe('valid_token');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should not include passwordHash or loginCapable in the signed payload', () => {
      const { sut } = makeSut();
      const signSpy = jest.spyOn(jwt, 'sign');

      sut.generateToken(makeTokenPayload());

      const signedPayload = signSpy.mock.calls[0]?.[0] as
        Record<string, unknown> | undefined;
      expect(signedPayload).toBeDefined();
      expect(signedPayload).not.toHaveProperty('passwordHash');
      expect(signedPayload).not.toHaveProperty('loginCapable');
    });

    it('should throw if JWT_SECRET is not set', () => {
      const envs = jest.requireMock('@configs/envs').default as {
        jwtSecret: string | undefined;
        tokenExpirationTime: string;
      };
      const originalSecret = envs.jwtSecret;
      envs.jwtSecret = undefined;

      const { sut } = makeSut();
      expect(() => sut.generateToken(makeTokenPayload())).toThrow(
        'JWT_SECRET is not set in environment variables',
      );

      envs.jwtSecret = originalSecret;
    });
  });

  describe('decode', () => {
    it('should call jwt.verify and return TokenPayload', () => {
      const { sut } = makeSut();
      const payload = makeTokenPayload({ sessionVersion: 1 });
      const verifySpy = jest
        .spyOn(jwt, 'verify')
        .mockReturnValue(payload as never);

      const decoded = sut.decode('any_token');

      expect(verifySpy).toHaveBeenCalledWith('any_token', 'any_secret');
      expect(decoded).toEqual(payload);
    });

    it('should default sessionVersion to 0 when claim is missing', () => {
      const { sut } = makeSut();
      jest.spyOn(jwt, 'verify').mockReturnValue({
        id: 'any_id',
        name: 'any_name',
        email: 'any_email@mail.com',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      } as never);

      const decoded = sut.decode('legacy_token');

      expect(decoded.sessionVersion).toBe(0);
    });

    it('should throw if jwt.verify returns a string', () => {
      const { sut } = makeSut();
      jest.spyOn(jwt, 'verify').mockReturnValue('invalid' as never);

      expect(() => sut.decode('any_token')).toThrow('Invalid token payload');
    });

    it('should throw if JWT_SECRET is not set', () => {
      const envs = jest.requireMock('@configs/envs').default as {
        jwtSecret: string | undefined;
        tokenExpirationTime: string;
      };
      const originalSecret = envs.jwtSecret;
      envs.jwtSecret = undefined;

      const { sut } = makeSut();
      expect(() => sut.decode('any_token')).toThrow(
        'JWT_SECRET is not set in environment variables',
      );

      envs.jwtSecret = originalSecret;
    });
  });
});
