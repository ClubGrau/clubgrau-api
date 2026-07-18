import express, { Express } from 'express';
import { Connection } from 'mongoose';
import { makeEmployeesModule } from '@modules/employees/employees.module';
import { BcryptAdapter } from '@shared/infrastructure/adapters/bcrypt/bcrypt.adapter';
import middlewares from '@shared/infrastructure/adapters/http/middlewares';

export type MakeAppDeps = {
  connection: Connection;
};

export function makeApp({ connection }: MakeAppDeps): Express {
  const app = express();
  middlewares(app);

  const encrypter = new BcryptAdapter();
  const employees = makeEmployeesModule({ connection, encrypter });

  app.use('/employee', employees.router);

  return app;
}
