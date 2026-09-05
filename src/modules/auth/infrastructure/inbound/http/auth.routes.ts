import { Router } from 'express';
import { AuthController } from '@modules/auth/presentation/controllers/auth.controller';
import { RequestPasswordResetController } from '@modules/auth/presentation/controllers/request-password-reset.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type AuthRoutesDependencies = {
  authController: AuthController;
  requestPasswordResetController: RequestPasswordResetController;
};

export function makeAuthRoutes({
  authController,
  requestPasswordResetController,
}: AuthRoutesDependencies): Router {
  const router = Router();
  router.post('/', adaptRoute(authController));
  // Rota pública (sem authTokenMiddleware): resposta sempre opaca.
  router.post('/password-reset', adaptRoute(requestPasswordResetController));
  return router;
}
