import { Connection } from 'mongoose';
import { RequestHandler, Router } from 'express';
import { FindIndicationOriginNamesByIdsPort } from '@modules/customers/application/ports/outbound/find-indication-origin-names-by-ids.port';
import { FindIndicationOriginPort } from '@modules/customers/application/ports/outbound/find-indication-origin.port';
import { CreateIndicationOriginPort } from '@modules/indications/application/ports/inbound/create-indication-origin.port';
import { CorrectIndicationOriginNamePort } from '@modules/indications/application/ports/inbound/correct-indication-origin-name.port';
import { EndIndicationOriginPort } from '@modules/indications/application/ports/inbound/end-indication-origin.port';
import { GetIndicationCatalogPort } from '@modules/indications/application/ports/inbound/get-indication-catalog.port';
import { GetLinkableIndicationOriginsPort } from '@modules/indications/application/ports/inbound/get-linkable-indication-origins.port';
import { ReopenIndicationOriginPort } from '@modules/indications/application/ports/inbound/reopen-indication-origin.port';
import { GetIndicationCatalogQuery } from '@modules/indications/application/queries/get-indication-catalog.query';
import { GetLinkableIndicationOriginsQuery } from '@modules/indications/application/queries/get-linkable-indication-origins.query';
import { CorrectIndicationOriginNameUsecase } from '@modules/indications/application/usecases/correct-indication-origin-name.usecase';
import { CreateIndicationOriginUsecase } from '@modules/indications/application/usecases/create-indication-origin.usecase';
import { EndIndicationOriginUsecase } from '@modules/indications/application/usecases/end-indication-origin.usecase';
import { ReopenIndicationOriginUsecase } from '@modules/indications/application/usecases/reopen-indication-origin.usecase';
import { IndicationOriginNamePolicy } from '@modules/indications/domain/services/indication-origin-name.policy';
import { makeIndicationRoutes } from '@modules/indications/infrastructure/inbound/http/indication.routes';
import { IndicationOriginLookupAdapter } from '@modules/indications/infrastructure/outbound/indication-origin-lookup.adapter';
import { IndicationOriginNamesLookupAdapter } from '@modules/indications/infrastructure/outbound/indication-origin-names-lookup.adapter';
import { IndicationOriginMongooseRepository } from '@modules/indications/infrastructure/outbound/persistence/indication-origin-mongoose.repository';
import { IndicationOriginSchema } from '@modules/indications/infrastructure/outbound/persistence/indication-origin.schema';
import { CorrectIndicationOriginNameController } from '@modules/indications/presentation/controllers/correct-indication-origin-name.controller';
import { CreateIndicationOriginController } from '@modules/indications/presentation/controllers/create-indication-origin.controller';
import { EndIndicationOriginController } from '@modules/indications/presentation/controllers/end-indication-origin.controller';
import { GetIndicationCatalogController } from '@modules/indications/presentation/controllers/get-indication-catalog.controller';
import { GetLinkableIndicationOriginsController } from '@modules/indications/presentation/controllers/get-linkable-indication-origins.controller';
import { ReopenIndicationOriginController } from '@modules/indications/presentation/controllers/reopen-indication-origin.controller';

export type IndicationsModule = {
  getIndicationCatalogController: GetIndicationCatalogController;
  createIndicationOriginController: CreateIndicationOriginController;
  correctIndicationOriginNameController: CorrectIndicationOriginNameController;
  endIndicationOriginController: EndIndicationOriginController;
  reopenIndicationOriginController: ReopenIndicationOriginController;
  getLinkableIndicationOriginsController: GetLinkableIndicationOriginsController;
  getIndicationCatalog: GetIndicationCatalogPort;
  createIndicationOrigin: CreateIndicationOriginPort;
  correctIndicationOriginName: CorrectIndicationOriginNamePort;
  endIndicationOrigin: EndIndicationOriginPort;
  reopenIndicationOrigin: ReopenIndicationOriginPort;
  getLinkableIndicationOrigins: GetLinkableIndicationOriginsPort;
  findIndicationOrigin: FindIndicationOriginPort;
  findIndicationOriginNamesByIds: FindIndicationOriginNamesByIdsPort;
  router: Router;
};

type IndicationsModuleDeps = {
  connection: Connection;
  authTokenMiddleware: RequestHandler;
  makeRequireRoles: (...roles: string[]) => RequestHandler;
};

export function makeIndicationsModule({
  connection,
  authTokenMiddleware,
  makeRequireRoles,
}: IndicationsModuleDeps): IndicationsModule {
  const indicationOriginModel = connection.model(
    'IndicationOrigin',
    IndicationOriginSchema,
  );
  const indicationOriginRepository = new IndicationOriginMongooseRepository(
    indicationOriginModel,
  );
  const namePolicy = new IndicationOriginNamePolicy(indicationOriginRepository);

  const createIndicationOrigin: CreateIndicationOriginPort =
    new CreateIndicationOriginUsecase(
      namePolicy,
      indicationOriginRepository,
      indicationOriginRepository,
    );
  const correctIndicationOriginName: CorrectIndicationOriginNamePort =
    new CorrectIndicationOriginNameUsecase(
      namePolicy,
      indicationOriginRepository,
      indicationOriginRepository,
    );
  const endIndicationOrigin: EndIndicationOriginPort =
    new EndIndicationOriginUsecase(
      indicationOriginRepository,
      indicationOriginRepository,
    );
  const reopenIndicationOrigin: ReopenIndicationOriginPort =
    new ReopenIndicationOriginUsecase(
      indicationOriginRepository,
      indicationOriginRepository,
    );
  const getIndicationCatalog: GetIndicationCatalogPort =
    new GetIndicationCatalogQuery(indicationOriginRepository);
  const getLinkableIndicationOrigins: GetLinkableIndicationOriginsPort =
    new GetLinkableIndicationOriginsQuery(indicationOriginRepository);
  const findIndicationOrigin = new IndicationOriginLookupAdapter(
    indicationOriginRepository,
  );
  const findIndicationOriginNamesByIds = new IndicationOriginNamesLookupAdapter(
    indicationOriginRepository,
  );

  const createIndicationOriginController = new CreateIndicationOriginController(
    createIndicationOrigin,
  );
  const correctIndicationOriginNameController =
    new CorrectIndicationOriginNameController(correctIndicationOriginName);
  const endIndicationOriginController = new EndIndicationOriginController(
    endIndicationOrigin,
  );
  const reopenIndicationOriginController = new ReopenIndicationOriginController(
    reopenIndicationOrigin,
  );
  const getIndicationCatalogController = new GetIndicationCatalogController(
    getIndicationCatalog,
  );
  const getLinkableIndicationOriginsController =
    new GetLinkableIndicationOriginsController(getLinkableIndicationOrigins);

  const router = makeIndicationRoutes({
    getIndicationCatalogController,
    createIndicationOriginController,
    correctIndicationOriginNameController,
    endIndicationOriginController,
    reopenIndicationOriginController,
    getLinkableIndicationOriginsController,
    authTokenMiddleware,
    requireRoles: makeRequireRoles,
  });

  return {
    getIndicationCatalogController,
    createIndicationOriginController,
    correctIndicationOriginNameController,
    endIndicationOriginController,
    reopenIndicationOriginController,
    getLinkableIndicationOriginsController,
    getIndicationCatalog,
    createIndicationOrigin,
    correctIndicationOriginName,
    endIndicationOrigin,
    reopenIndicationOrigin,
    getLinkableIndicationOrigins,
    findIndicationOrigin,
    findIndicationOriginNamesByIds,
    router,
  };
}
