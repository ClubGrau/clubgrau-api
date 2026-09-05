import { Router } from 'express';
import { Connection } from 'mongoose';
import { LoginPort } from '@modules/auth/application/ports/inbound/login.port';
import { RequestPasswordResetPort } from '@modules/auth/application/ports/inbound/request-password-reset.port';
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
import { RequestPasswordResetController } from '@modules/auth/presentation/controllers/request-password-reset.controller';
import { EmployeeSchema } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { MailerPort } from '@shared/application/ports/mailer.port';

export type AuthModule = {
  authController: AuthController;
  requestPasswordResetController: RequestPasswordResetController;
  login: LoginPort;
  requestPasswordReset: RequestPasswordResetPort;
  authTokenMiddleware: AuthTokenMiddleware;
  makeRequireRoles: (...roles: string[]) => RequireRolesMiddleware;
  router: Router;
};

type AuthModuleDeps = {
  connection: Connection;
  compareHash: CompareHashPort;
  mailer: MailerPort;
  frontendPublicOrigin: string;
};

export function makeAuthModule({
  connection,
  compareHash,
  mailer,
  frontendPublicOrigin,
}: AuthModuleDeps): AuthModule {
  const employeeModel = connection.model('Employee', EmployeeSchema);
  const findAuthenticatableByEmail = new EmployeeAuthAdapter(employeeModel);
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
    findAuthenticatableByEmail,
    compareHash,
    jwtTokenAdapter,
  );

  const requestPasswordReset: RequestPasswordResetPort =
    new RequestPasswordResetUsecase(
      findAuthenticatableByEmail,
      passwordResetTokenRepository,
      passwordResetTokenRepository,
      resetTokenHasher,
      rawResetTokenGenerator,
      mailer,
      frontendPublicOrigin,
    );

  const authController = new AuthController(login);
  const requestPasswordResetController = new RequestPasswordResetController(
    requestPasswordReset,
  );
  const authTokenMiddleware = makeAuthTokenMiddleware(jwtTokenAdapter);

  return {
    authController,
    requestPasswordResetController,
    login,
    requestPasswordReset,
    authTokenMiddleware,
    makeRequireRoles,
    router: makeAuthRoutes({ authController, requestPasswordResetController }),
  };
}
