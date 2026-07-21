import { RequestHandler, Router } from 'express';
import { CreateCustomerController } from '@modules/customers/presentation/controllers/create-customer.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type CustomerRoutesDependencies = {
  createCustomerController: CreateCustomerController;
  authTokenMiddleware: RequestHandler;
};

export function makeCustomerRoutes({
  createCustomerController,
  authTokenMiddleware,
}: CustomerRoutesDependencies): Router {
  const router = Router();

  router.post(
    '/customer',
    authTokenMiddleware,
    adaptRoute(createCustomerController),
  );

  return router;
}
