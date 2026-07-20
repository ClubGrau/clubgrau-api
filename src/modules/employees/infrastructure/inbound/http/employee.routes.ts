import { RequestHandler, Router } from 'express';
import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { GetEmployeesController } from '@modules/employees/presentation/controllers/get-employees.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type EmployeeRoutesDependencies = {
  createEmployeeController: CreateEmployeeController;
  getEmployeesController: GetEmployeesController;
  authTokenMiddleware: RequestHandler;
};

export function makeEmployeeRoutes({
  createEmployeeController,
  getEmployeesController,
  authTokenMiddleware,
}: EmployeeRoutesDependencies): Router {
  const router = Router();

  router.get(
    '/employees',
    authTokenMiddleware,
    adaptRoute(getEmployeesController),
  );
  router.post(
    '/employee',
    authTokenMiddleware,
    adaptRoute(createEmployeeController),
  );

  return router;
}
