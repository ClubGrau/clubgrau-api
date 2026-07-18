import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { Router } from 'express';
import { adaptRoute } from './express-route.adapter';

export type EmployeeRoutesDependencies = {
  createEmployeeController: CreateEmployeeController;
};

export function makeEmployeeRoutes({
  createEmployeeController,
}: EmployeeRoutesDependencies): Router {
  const router = Router();
  router.post('/', adaptRoute(createEmployeeController));
  return router;
}
