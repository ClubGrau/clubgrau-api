import { RequestHandler, Router } from 'express';
import { CreateCustomerController } from '@modules/customers/presentation/controllers/create-customer.controller';
import { GetCustomersController } from '@modules/customers/presentation/controllers/get-customers.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type CustomerRoutesDependencies = {
  createCustomerController: CreateCustomerController;
  getCustomersController: GetCustomersController;
  authTokenMiddleware: RequestHandler;
};

export function makeCustomerRoutes({
  createCustomerController,
  getCustomersController,
  authTokenMiddleware,
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

  return router;
}
