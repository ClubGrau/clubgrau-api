import { Router } from 'express';
import { CheckLivenessController } from '@modules/health/presentation/controllers/check-liveness.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type HealthRoutesDependencies = {
  checkLivenessController: CheckLivenessController;
};

export function makeHealthRoutes({
  checkLivenessController,
}: HealthRoutesDependencies): Router {
  const router = Router();

  router.get('/health/liveness', adaptRoute(checkLivenessController));

  return router;
}
