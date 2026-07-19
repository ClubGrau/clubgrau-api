import { Router } from 'express';
import { AuthController } from '@modules/auth/presentation/controllers/auth.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type AuthRoutesDependencies = {
  authController: AuthController;
};

export function makeAuthRoutes({
  authController,
}: AuthRoutesDependencies): Router {
  const router = Router();
  router.post('/', adaptRoute(authController));
  return router;
}
