import express, { Express } from 'express';
import { Connection } from 'mongoose';
import { makeAuthModule } from '@modules/auth/auth.module';
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
  const employees = makeEmployeesModule({
    connection,
    encrypter: bcryptAdapter,
  });
  const auth = makeAuthModule({
    connection,
    compareHash: bcryptAdapter,
  });

  app.use('/employee', employees.router);
  app.use('/auth', auth.router);

  return app;
}
