import { Connection } from 'mongoose';
import { RequestHandler, Router } from 'express';
import { CreateCustomerPort } from '@modules/customers/application/ports/inbound/create-customer.port';
import { GetCustomersPort } from '@modules/customers/application/ports/inbound/get-customers.port';
import { RemoveCustomerPort } from '@modules/customers/application/ports/inbound/remove-customer.port';
import { FindIndicationOriginNamesByIdsPort } from '@modules/customers/application/ports/outbound/find-indication-origin-names-by-ids.port';
import { FindIndicationOriginPort } from '@modules/customers/application/ports/outbound/find-indication-origin.port';
import { VerifyActorPasswordPort } from '@modules/customers/application/ports/outbound/verify-actor-password.port';
import { GetCustomersQuery } from '@modules/customers/application/queries/get-customers.query';
import { CreateCustomerUsecase } from '@modules/customers/application/usecases/create-customer.usecase';
import { RemoveCustomerUsecase } from '@modules/customers/application/usecases/remove-customer.usecase';
import { CustomerPoliciesService } from '@modules/customers/domain/services/customer-policies.service';
import { makeCustomerRoutes } from '@modules/customers/infrastructure/inbound/http/customer.routes';
import { CustomerSchema } from '@modules/customers/infrastructure/outbound/persistence/customer.schema';
import { CustomerMongooseRepository } from '@modules/customers/infrastructure/outbound/persistence/customer-mongoose.repository';
import { CreateCustomerController } from '@modules/customers/presentation/controllers/create-customer.controller';
import { GetCustomersController } from '@modules/customers/presentation/controllers/get-customers.controller';
import { RemoveCustomerController } from '@modules/customers/presentation/controllers/remove-customer.controller';

export type CustomersModule = {
  createCustomerController: CreateCustomerController;
  getCustomersController: GetCustomersController;
  removeCustomerController: RemoveCustomerController;
  createCustomer: CreateCustomerPort;
  getCustomers: GetCustomersPort;
  removeCustomer: RemoveCustomerPort;
  router: Router;
};

type CustomersModuleDeps = {
  connection: Connection;
  authTokenMiddleware: RequestHandler;
  makeRequireRoles: (...roles: string[]) => RequestHandler;
  findIndicationOrigin: FindIndicationOriginPort;
  findIndicationOriginNamesByIds: FindIndicationOriginNamesByIdsPort;
  verifyActorPassword: VerifyActorPasswordPort;
};

export function makeCustomersModule({
  connection,
  authTokenMiddleware,
  makeRequireRoles,
  findIndicationOrigin,
  findIndicationOriginNamesByIds,
  verifyActorPassword,
}: CustomersModuleDeps): CustomersModule {
  const customerModel = connection.model('Customer', CustomerSchema);
  const customerRepository = new CustomerMongooseRepository(customerModel);
  const customerPoliciesService = new CustomerPoliciesService(
    customerRepository,
  );

  const createCustomer: CreateCustomerPort = new CreateCustomerUsecase(
    customerPoliciesService,
    findIndicationOrigin,
    customerRepository,
    customerRepository,
  );

  const createCustomerController = new CreateCustomerController(createCustomer);

  const getCustomers: GetCustomersPort = new GetCustomersQuery(
    customerRepository,
    findIndicationOriginNamesByIds,
    customerRepository,
  );
  const getCustomersController = new GetCustomersController(getCustomers);

  const removeCustomer: RemoveCustomerPort = new RemoveCustomerUsecase(
    verifyActorPassword,
    customerRepository,
    customerRepository,
  );
  const removeCustomerController = new RemoveCustomerController(removeCustomer);

  const router = makeCustomerRoutes({
    createCustomerController,
    getCustomersController,
    removeCustomerController,
    authTokenMiddleware,
    makeRequireRoles,
  });

  return {
    createCustomerController,
    getCustomersController,
    removeCustomerController,
    createCustomer,
    getCustomers,
    removeCustomer,
    router,
  };
}
