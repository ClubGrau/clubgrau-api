import { Router } from 'express';
import { Connection } from 'mongoose';
import { LoginPort } from '@modules/auth/application/ports/inbound/login.port';
import { LoginUseCase } from '@modules/auth/application/usecases/login.usecase';
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
import { JwtTokenAdapter } from '@modules/auth/infrastructure/outbound/token/jwt-token.adapter';
import { AuthController } from '@modules/auth/presentation/controllers/auth.controller';
import { EmployeeSchema } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';

export type AuthModule = {
  authController: AuthController;
  login: LoginPort;
  authTokenMiddleware: AuthTokenMiddleware;
  makeRequireRoles: (...roles: string[]) => RequireRolesMiddleware;
  router: Router;
};

type AuthModuleDeps = {
  connection: Connection;
  compareHash: CompareHashPort;
};

export function makeAuthModule({
  connection,
  compareHash,
}: AuthModuleDeps): AuthModule {
  const employeeModel = connection.model('Employee', EmployeeSchema);
  const findAuthenticatableByEmail = new EmployeeAuthAdapter(employeeModel);
  const jwtTokenAdapter = new JwtTokenAdapter();

  const login: LoginPort = new LoginUseCase(
    findAuthenticatableByEmail,
    compareHash,
    jwtTokenAdapter,
  );

  const authController = new AuthController(login);
  const authTokenMiddleware = makeAuthTokenMiddleware(jwtTokenAdapter);

  return {
    authController,
    login,
    authTokenMiddleware,
    makeRequireRoles,
    router: makeAuthRoutes({ authController }),
  };
}
