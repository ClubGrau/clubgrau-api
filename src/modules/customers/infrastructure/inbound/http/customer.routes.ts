import { RequestHandler, Router } from 'express';
import { CreateCustomerController } from '@modules/customers/presentation/controllers/create-customer.controller';
import { GetCustomersController } from '@modules/customers/presentation/controllers/get-customers.controller';
import { RemoveCustomerController } from '@modules/customers/presentation/controllers/remove-customer.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type CustomerRoutesDependencies = {
  createCustomerController: CreateCustomerController;
  getCustomersController: GetCustomersController;
  removeCustomerController: RemoveCustomerController;
  authTokenMiddleware: RequestHandler;
  makeRequireRoles: (...roles: string[]) => RequestHandler;
};

export function makeCustomerRoutes({
  createCustomerController,
  getCustomersController,
  removeCustomerController,
  authTokenMiddleware,
  makeRequireRoles,
}: CustomerRoutesDependencies): Router {
  const router = Router();

  router.get(
    '/customers',
    authTokenMiddleware,
    adaptRoute(getCustomersController),
  );
  router.post(
    '/customer',
    authTokenMiddleware,
    adaptRoute(createCustomerController),
  );
  router.post(
    '/customer/remove',
    authTokenMiddleware,
    makeRequireRoles('ADMIN', 'MANAGER'),
    adaptRoute(removeCustomerController),
  );

  return router;
}
