import { Connection } from 'mongoose';
import { RequestHandler, Router } from 'express';
import { CreateCustomerPort } from '@modules/customers/application/ports/inbound/create-customer.port';
import { GetCustomersPort } from '@modules/customers/application/ports/inbound/get-customers.port';
import { FindIndicationOriginNamesByIdsPort } from '@modules/customers/application/ports/outbound/find-indication-origin-names-by-ids.port';
import { FindIndicationOriginPort } from '@modules/customers/application/ports/outbound/find-indication-origin.port';
import { GetCustomersQuery } from '@modules/customers/application/queries/get-customers.query';
import { CreateCustomerUsecase } from '@modules/customers/application/usecases/create-customer.usecase';
import { CustomerPoliciesService } from '@modules/customers/domain/services/customer-policies.service';
import { makeCustomerRoutes } from '@modules/customers/infrastructure/inbound/http/customer.routes';
import { CustomerSchema } from '@modules/customers/infrastructure/outbound/persistence/customer.schema';
import { CustomerMongooseRepository } from '@modules/customers/infrastructure/outbound/persistence/customer-mongoose.repository';
import { CreateCustomerController } from '@modules/customers/presentation/controllers/create-customer.controller';
import { GetCustomersController } from '@modules/customers/presentation/controllers/get-customers.controller';

export type CustomersModule = {
  createCustomerController: CreateCustomerController;
  getCustomersController: GetCustomersController;
  createCustomer: CreateCustomerPort;
  getCustomers: GetCustomersPort;
  router: Router;
};

type CustomersModuleDeps = {
  connection: Connection;
  authTokenMiddleware: RequestHandler;
  findIndicationOrigin: FindIndicationOriginPort;
  findIndicationOriginNamesByIds: FindIndicationOriginNamesByIdsPort;
};

export function makeCustomersModule({
  connection,
  authTokenMiddleware,
  findIndicationOrigin,
  findIndicationOriginNamesByIds,
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

  const router = makeCustomerRoutes({
    createCustomerController,
    getCustomersController,
    authTokenMiddleware,
  });

  return {
    createCustomerController,
    getCustomersController,
    createCustomer,
    getCustomers,
    router,
  };
}
