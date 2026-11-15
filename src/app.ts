import express, { Express } from 'express';
import { Connection } from 'mongoose';
import envs from '@configs/envs';
import { makeAuthModule } from '@modules/auth/auth.module';
import { makeCustomersModule } from '@modules/customers/customers.module';
import {
  makeActorAuthenticationFailedError,
  makeEmployeesModule,
} from '@modules/employees/employees.module';
import { makeHealthModule } from '@modules/health/health.module';
import { makeIndicationsModule } from '@modules/indications/indications.module';
import { StartLivenessKeepAlivePort } from '@modules/health/application/ports/inbound/start-liveness-keep-alive.port';
import { BcryptAdapter } from '@shared/infrastructure/adapters/bcrypt/bcrypt.adapter';
import { ResendMailerAdapter } from '@shared/infrastructure/adapters/resend/resend-mailer.adapter';
import middlewares from '@shared/infrastructure/adapters/http/middlewares';

export type MakeAppDeps = {
  connection: Connection;
};

export type AppComposition = {
  app: Express;
  keepAlive: StartLivenessKeepAlivePort;
};

export function makeApp({ connection }: MakeAppDeps): AppComposition {
  const app = express();
  middlewares(app);

  const bcryptAdapter = new BcryptAdapter();
  const mailerAdapter = new ResendMailerAdapter();

  const health = makeHealthModule({
    keepAliveEnabled: envs.keepAliveEnabled,
    appPublicUrl: envs.appPublicUrl,
  });

  const auth = makeAuthModule({
    connection,
    compareHash: bcryptAdapter,
    encrypter: bcryptAdapter,
    mailer: mailerAdapter,
    frontendPublicOrigin: envs.frontendPublicOrigin ?? '',
    reissueAuthenticationFailedError: makeActorAuthenticationFailedError,
  });

  const employees = makeEmployeesModule({
    connection,
    encrypter: bcryptAdapter,
    compareHash: bcryptAdapter,
    authTokenMiddleware: auth.authTokenMiddleware,
    makeRequireRoles: auth.makeRequireRoles,
    reissueOwnSessionToken: auth.reissueOwnSessionToken,
  });

  const indications = makeIndicationsModule({
    connection,
    authTokenMiddleware: auth.authTokenMiddleware,
    makeRequireRoles: auth.makeRequireRoles,
  });

  const customers = makeCustomersModule({
    connection,
    authTokenMiddleware: auth.authTokenMiddleware,
    makeRequireRoles: auth.makeRequireRoles,
    findIndicationOrigin: indications.findIndicationOrigin,
    findIndicationOriginNamesByIds: indications.findIndicationOriginNamesByIds,
    verifyActorPassword: auth.verifyActorPassword,
  });

  app.use(health.router);
  app.use('/api', employees.router);
  app.use('/api', customers.router);
  app.use('/api', indications.router);
  app.use('/auth', auth.router);

  return { app, keepAlive: health.keepAlive };
}
