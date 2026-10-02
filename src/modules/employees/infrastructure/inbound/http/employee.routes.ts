import { RequestHandler, Router } from 'express';
import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { GetEmployeesController } from '@modules/employees/presentation/controllers/get-employees.controller';
import { RemoveEmployeeController } from '@modules/employees/presentation/controllers/remove-employee.controller';
import { UpdateEmployeeStatusController } from '@modules/employees/presentation/controllers/update-employee-status.controller';
import { GetOwnEmployeeController } from '@modules/employees/presentation/controllers/get-own-employee.controller';
import { UpdateMainEmployeeDataController } from '@modules/employees/presentation/controllers/update-main-employee-data.controller';
import { UpdateOwnEmployeeDataController } from '@modules/employees/presentation/controllers/update-own-employee-data.controller';
import { UpdatePersonalEmployeeDataController } from '@modules/employees/presentation/controllers/update-personal-employee-data.controller';
import { UpdateProfessionalEmployeeDataController } from '@modules/employees/presentation/controllers/update-professional-employee-data.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type EmployeeRoutesDependencies = {
  createEmployeeController: CreateEmployeeController;
  getEmployeesController: GetEmployeesController;
  updateEmployeeStatusController: UpdateEmployeeStatusController;
  updateMainEmployeeDataController: UpdateMainEmployeeDataController;
  updatePersonalEmployeeDataController: UpdatePersonalEmployeeDataController;
  updateProfessionalEmployeeDataController: UpdateProfessionalEmployeeDataController;
  getOwnEmployeeController: GetOwnEmployeeController;
  updateOwnEmployeeDataController: UpdateOwnEmployeeDataController;
  removeEmployeeController: RemoveEmployeeController;
  authTokenMiddleware: RequestHandler;
  requireRoles: (...roles: string[]) => RequestHandler;
};

export function makeEmployeeRoutes({
  createEmployeeController,
  getEmployeesController,
  updateEmployeeStatusController,
  updateMainEmployeeDataController,
  updatePersonalEmployeeDataController,
  updateProfessionalEmployeeDataController,
  getOwnEmployeeController,
  updateOwnEmployeeDataController,
  removeEmployeeController,
  authTokenMiddleware,
  requireRoles,
}: EmployeeRoutesDependencies): Router {
  const router = Router();
  const requiredRoleEmployee = requireRoles('ADMIN', 'MANAGER');

  router.get(
    '/employees',
    authTokenMiddleware,
    requiredRoleEmployee,
    adaptRoute(getEmployeesController),
  );
  router.post(
    '/employee',
    authTokenMiddleware,
    requiredRoleEmployee,
    adaptRoute(createEmployeeController),
  );
  router.post(
    '/employee/update-status',
    authTokenMiddleware,
    requiredRoleEmployee,
    adaptRoute(updateEmployeeStatusController),
  );
  router.post(
    '/employee/remove',
    authTokenMiddleware,
    requiredRoleEmployee,
    adaptRoute(removeEmployeeController),
  );
  router.get(
    '/employee/me',
    authTokenMiddleware,
    adaptRoute(getOwnEmployeeController),
  );
  router.patch(
    '/employee/me',
    authTokenMiddleware,
    adaptRoute(updateOwnEmployeeDataController),
  );
  router.patch(
    '/employee/:id/main-data',
    authTokenMiddleware,
    requiredRoleEmployee,
    adaptRoute(updateMainEmployeeDataController),
  );
  router.patch(
    '/employee/:id/personal-data',
    authTokenMiddleware,
    requiredRoleEmployee,
    adaptRoute(updatePersonalEmployeeDataController),
  );
  router.patch(
    '/employee/:id/professional-data',
    authTokenMiddleware,
    requiredRoleEmployee,
    adaptRoute(updateProfessionalEmployeeDataController),
  );

  return router;
}
