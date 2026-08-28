import { RequestHandler, Router } from 'express';
import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { GetEmployeesController } from '@modules/employees/presentation/controllers/get-employees.controller';
import { RemoveEmployeeController } from '@modules/employees/presentation/controllers/remove-employee.controller';
import { UpdateEmployeeStatusController } from '@modules/employees/presentation/controllers/update-employee-status.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type EmployeeRoutesDependencies = {
  createEmployeeController: CreateEmployeeController;
  getEmployeesController: GetEmployeesController;
  updateEmployeeStatusController: UpdateEmployeeStatusController;
  removeEmployeeController: RemoveEmployeeController;
  authTokenMiddleware: RequestHandler;
  requireRoles: (...roles: string[]) => RequestHandler;
};

export function makeEmployeeRoutes({
  createEmployeeController,
  getEmployeesController,
  updateEmployeeStatusController,
  removeEmployeeController,
  authTokenMiddleware,
  requireRoles,
}: EmployeeRoutesDependencies): Router {
  const router = Router();

  router.get(
    '/employees',
    authTokenMiddleware,
    requireRoles('ADMIN', 'MANAGER'),
    adaptRoute(getEmployeesController),
  );
  router.post(
    '/employee',
    authTokenMiddleware,
    requireRoles('ADMIN', 'MANAGER'),
    adaptRoute(createEmployeeController),
  );
  router.post(
    '/employee/update-status',
    authTokenMiddleware,
    adaptRoute(updateEmployeeStatusController),
  );
  router.post(
    '/employee/remove',
    authTokenMiddleware,
    adaptRoute(removeEmployeeController),
  );

  return router;
}
