import express, { Express } from 'express';
import { Connection } from 'mongoose';
import { makeAuthModule } from '@modules/auth/auth.module';
import { makeCustomersModule } from '@modules/customers/customers.module';
import { makeEmployeesModule } from '@modules/employees/employees.module';
import { BcryptAdapter } from '@shared/infrastructure/adapters/bcrypt/bcrypt.adapter';
import middlewares from '@shared/infrastructure/adapters/http/middlewares';

export type MakeAppDeps = {
  connection: Connection;
};

export function makeApp({ connection }: MakeAppDeps): Express {
  const app = express();
  middlewares(app);

  const bcryptAdapter = new BcryptAdapter();

  const auth = makeAuthModule({
    connection,
    compareHash: bcryptAdapter,
  });

  const employees = makeEmployeesModule({
    connection,
    encrypter: bcryptAdapter,
    authTokenMiddleware: auth.authTokenMiddleware,
  });

  const customers = makeCustomersModule({
    connection,
    authTokenMiddleware: auth.authTokenMiddleware,
  });

  app.use('/api', employees.router);
  app.use('/api', customers.router);
  app.use('/api', auth.router);

  return app;
}
