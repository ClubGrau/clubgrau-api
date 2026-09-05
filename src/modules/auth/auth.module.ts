import { Router } from 'express';
import { Connection } from 'mongoose';
import { CompletePasswordResetPort } from '@modules/auth/application/ports/inbound/complete-password-reset.port';
import { LoginPort } from '@modules/auth/application/ports/inbound/login.port';
import { RequestPasswordResetPort } from '@modules/auth/application/ports/inbound/request-password-reset.port';
import { CompletePasswordResetUsecase } from '@modules/auth/application/usecases/complete-password-reset.usecase';
import { LoginUseCase } from '@modules/auth/application/usecases/login.usecase';
import { RequestPasswordResetUsecase } from '@modules/auth/application/usecases/request-password-reset.usecase';
import {
  AuthTokenMiddleware,
  makeAuthTokenMiddleware,
} from '@modules/auth/infrastructure/inbound/http/auth-token.middleware';
import {
  makeRequireRoles,
  RequireRolesMiddleware,
} from '@modules/auth/infrastructure/inbound/http/require-roles.middleware';
import { makeAuthRoutes } from '@modules/auth/infrastructure/inbound/http/auth.routes';
import { EmployeeAuthAdapter } from '@modules/auth/infrastructure/outbound/persistence/employee-auth.adapter';
import { PasswordResetTokenMongooseRepository } from '@modules/auth/infrastructure/outbound/persistence/password-reset-token-mongoose.repository';
import { PasswordResetTokenSchema } from '@modules/auth/infrastructure/outbound/persistence/password-reset-token.schema';
import { HmacResetTokenHasher } from '@modules/auth/infrastructure/outbound/crypto/hmac-reset-token-hasher';
import { CryptoRawResetTokenGenerator } from '@modules/auth/infrastructure/outbound/crypto/crypto-raw-reset-token.generator';
import { JwtTokenAdapter } from '@modules/auth/infrastructure/outbound/token/jwt-token.adapter';
import { AuthController } from '@modules/auth/presentation/controllers/auth.controller';
import { CompletePasswordResetController } from '@modules/auth/presentation/controllers/complete-password-reset.controller';
import { RequestPasswordResetController } from '@modules/auth/presentation/controllers/request-password-reset.controller';
import { EmployeeSchema } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import { MailerPort } from '@shared/application/ports/mailer.port';

export type AuthModule = {
  authController: AuthController;
  requestPasswordResetController: RequestPasswordResetController;
  completePasswordResetController: CompletePasswordResetController;
  login: LoginPort;
  requestPasswordReset: RequestPasswordResetPort;
  completePasswordReset: CompletePasswordResetPort;
  authTokenMiddleware: AuthTokenMiddleware;
  makeRequireRoles: (...roles: string[]) => RequireRolesMiddleware;
  router: Router;
};

type AuthModuleDeps = {
  connection: Connection;
  compareHash: CompareHashPort;
  encrypter: EncrypterPort;
  mailer: MailerPort;
  frontendPublicOrigin: string;
};

export function makeAuthModule({
  connection,
  compareHash,
  encrypter,
  mailer,
  frontendPublicOrigin,
}: AuthModuleDeps): AuthModule {
  const employeeModel = connection.model('Employee', EmployeeSchema);
  const employeeAuthAdapter = new EmployeeAuthAdapter(employeeModel);
  const jwtTokenAdapter = new JwtTokenAdapter();

  const passwordResetTokenModel = connection.model(
    'PasswordResetToken',
    PasswordResetTokenSchema,
  );
  const passwordResetTokenRepository = new PasswordResetTokenMongooseRepository(
    passwordResetTokenModel,
  );
  const resetTokenHasher = new HmacResetTokenHasher();
  const rawResetTokenGenerator = new CryptoRawResetTokenGenerator();

  const login: LoginPort = new LoginUseCase(
    employeeAuthAdapter,
    compareHash,
    jwtTokenAdapter,
  );

  const requestPasswordReset: RequestPasswordResetPort =
    new RequestPasswordResetUsecase(
      employeeAuthAdapter,
      passwordResetTokenRepository,
      passwordResetTokenRepository,
      resetTokenHasher,
      rawResetTokenGenerator,
      mailer,
      frontendPublicOrigin,
    );

  const completePasswordReset: CompletePasswordResetPort =
    new CompletePasswordResetUsecase(
      passwordResetTokenRepository,
      employeeAuthAdapter,
      passwordResetTokenRepository,
      employeeAuthAdapter,
      encrypter,
      resetTokenHasher,
    );

  const authController = new AuthController(login);
  const requestPasswordResetController = new RequestPasswordResetController(
    requestPasswordReset,
  );
  const completePasswordResetController = new CompletePasswordResetController(
    completePasswordReset,
  );
  const authTokenMiddleware = makeAuthTokenMiddleware(
    jwtTokenAdapter,
    employeeAuthAdapter,
  );

  return {
    authController,
    requestPasswordResetController,
    completePasswordResetController,
    login,
    requestPasswordReset,
    completePasswordReset,
    authTokenMiddleware,
    makeRequireRoles,
    router: makeAuthRoutes({
      authController,
      requestPasswordResetController,
      completePasswordResetController,
    }),
  };
}
