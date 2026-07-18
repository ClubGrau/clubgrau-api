import express, { Express } from 'express';
import { Connection } from 'mongoose';
import { makeEmployeesModule } from '@modules/employees/employees.module';
import { BcryptAdapter } from '@shared/infrastructure/adapters/bcrypt/bcrypt.adapter';

export type MakeAppDeps = {
  connection: Connection;
};

export function makeApp({ connection }: MakeAppDeps): Express {
  const app = express();
  app.use(express.json());

  const encrypter = new BcryptAdapter();
  const employees = makeEmployeesModule({ connection, encrypter });

  app.use('/employee', employees.router);

  return app;
}
