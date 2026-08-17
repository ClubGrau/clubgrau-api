import * as jwt from 'jsonwebtoken';
import { AuthenticatableUser } from '@modules/auth/domain/models/authenticatable-user.model';
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

const makeValidPayload = (): AuthenticatableUser => ({
  id: 'any_id',
  name: 'any_name',
  email: 'any_email@mail.com',
  passwordHash: 'hashed_password',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
});

const makeTokenPayload = (): TokenPayload => ({
  id: 'any_id',
  name: 'any_name',
  email: 'any_email@mail.com',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
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
      const payload = makeValidPayload();

      const { token } = sut.generateToken(payload);

      expect(signSpy).toHaveBeenCalledWith(
        {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          status: payload.status,
        },
        'any_secret',
        { expiresIn: 30 },
      );
      expect(token).toBe('valid_token');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should not include passwordHash in the signed payload', () => {
      const { sut } = makeSut();
      const signSpy = jest.spyOn(jwt, 'sign');

      sut.generateToken(makeValidPayload());

      const signedPayload = signSpy.mock.calls[0]?.[0] as
        Record<string, unknown> | undefined;
      expect(signedPayload).toBeDefined();
      expect(signedPayload).not.toHaveProperty('passwordHash');
    });

    it('should throw if JWT_SECRET is not set', () => {
      const envs = jest.requireMock('@configs/envs').default as {
        jwtSecret: string | undefined;
        tokenExpirationTime: string;
      };
      const originalSecret = envs.jwtSecret;
      envs.jwtSecret = undefined;

      const { sut } = makeSut();
      expect(() => sut.generateToken(makeValidPayload())).toThrow(
        'JWT_SECRET is not set in environment variables',
      );

      envs.jwtSecret = originalSecret;
    });
  });

  describe('decode', () => {
    it('should call jwt.verify and return TokenPayload', () => {
      const { sut } = makeSut();
      const payload = makeTokenPayload();
      const verifySpy = jest
        .spyOn(jwt, 'verify')
        .mockReturnValue(payload as never);

      const decoded = sut.decode('any_token');

      expect(verifySpy).toHaveBeenCalledWith('any_token', 'any_secret');
      expect(decoded).toEqual(payload);
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
