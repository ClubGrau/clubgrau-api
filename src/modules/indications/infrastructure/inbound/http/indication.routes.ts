import { RequestHandler, Router } from 'express';
import { CorrectIndicationOriginNameController } from '@modules/indications/presentation/controllers/correct-indication-origin-name.controller';
import { CreateIndicationOriginController } from '@modules/indications/presentation/controllers/create-indication-origin.controller';
import { EndIndicationOriginController } from '@modules/indications/presentation/controllers/end-indication-origin.controller';
import { GetIndicationCatalogController } from '@modules/indications/presentation/controllers/get-indication-catalog.controller';
import { ReopenIndicationOriginController } from '@modules/indications/presentation/controllers/reopen-indication-origin.controller';
import { adaptRoute } from '@shared/infrastructure/adapters/http/express-route.adapter';

export type IndicationRoutesDependencies = {
  getIndicationCatalogController: GetIndicationCatalogController;
  createIndicationOriginController: CreateIndicationOriginController;
  correctIndicationOriginNameController: CorrectIndicationOriginNameController;
  endIndicationOriginController: EndIndicationOriginController;
  reopenIndicationOriginController: ReopenIndicationOriginController;
  authTokenMiddleware: RequestHandler;
  requireRoles: (...roles: string[]) => RequestHandler;
};

export function makeIndicationRoutes({
  getIndicationCatalogController,
  createIndicationOriginController,
  correctIndicationOriginNameController,
  endIndicationOriginController,
  reopenIndicationOriginController,
  authTokenMiddleware,
  requireRoles,
}: IndicationRoutesDependencies): Router {
  const router = Router();
  const requiredRole = requireRoles('ADMIN', 'MANAGER');

  router.get(
    '/indication-catalog',
    authTokenMiddleware,
    requiredRole,
    adaptRoute(getIndicationCatalogController),
  );
  router.post(
    '/indication-origin',
    authTokenMiddleware,
    requiredRole,
    adaptRoute(createIndicationOriginController),
  );
  router.patch(
    '/indication-origin/:id',
    authTokenMiddleware,
    requiredRole,
    adaptRoute(correctIndicationOriginNameController),
  );
  router.post(
    '/indication-origin/:id/end',
    authTokenMiddleware,
    requiredRole,
    adaptRoute(endIndicationOriginController),
  );
  router.post(
    '/indication-origin/:id/reopen',
    authTokenMiddleware,
    requiredRole,
    adaptRoute(reopenIndicationOriginController),
  );

  return router;
}
