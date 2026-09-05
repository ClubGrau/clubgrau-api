import { Router } from 'express';
import { AuthController } from '@modules/auth/presentation/controllers/auth.controller';
import { CompletePasswordResetController } from '@modules/auth/presentation/controllers/complete-password-reset.controller';
import { RequestPasswordResetController } from '@modules/auth/presentation/controllers/request-password-reset.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type AuthRoutesDependencies = {
  authController: AuthController;
  requestPasswordResetController: RequestPasswordResetController;
  completePasswordResetController: CompletePasswordResetController;
};

export function makeAuthRoutes({
  authController,
  requestPasswordResetController,
  completePasswordResetController,
}: AuthRoutesDependencies): Router {
  const router = Router();
  router.post('/', adaptRoute(authController));
  // Rota pública (sem authTokenMiddleware): resposta sempre opaca.
  router.post('/password-reset', adaptRoute(requestPasswordResetController));
  // Rota pública (sem authTokenMiddleware): completa o reset com token + nova senha.
  router.post(
    '/password-reset/complete',
    adaptRoute(completePasswordResetController),
  );
  return router;
}
