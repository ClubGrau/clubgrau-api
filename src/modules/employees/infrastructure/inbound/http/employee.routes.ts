import { RequestHandler, Router } from 'express';
import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { GetEmployeesController } from '@modules/employees/presentation/controllers/get-employees.controller';
import { UpdateEmployeeStatusController } from '@modules/employees/presentation/controllers/update-employee-status.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type EmployeeRoutesDependencies = {
  createEmployeeController: CreateEmployeeController;
  getEmployeesController: GetEmployeesController;
  updateEmployeeStatusController: UpdateEmployeeStatusController;
  authTokenMiddleware: RequestHandler;
};

export function makeEmployeeRoutes({
  createEmployeeController,
  getEmployeesController,
  updateEmployeeStatusController,
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
  router.post(
    '/employee/update-status',
    authTokenMiddleware,
    adaptRoute(updateEmployeeStatusController),
  );

  return router;
}
