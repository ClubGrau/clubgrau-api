import { Connection } from 'mongoose';
import { RequestHandler, Router } from 'express';
import { CreateCustomerPort } from '@modules/customers/application/ports/inbound/create-customer.port';
import { FindIndicationOriginPort } from '@modules/customers/application/ports/outbound/find-indication-origin.port';
import { CreateCustomerUsecase } from '@modules/customers/application/usecases/create-customer.usecase';
import { CustomerPoliciesService } from '@modules/customers/domain/services/customer-policies.service';
import { makeCustomerRoutes } from '@modules/customers/infrastructure/inbound/http/customer.routes';
import { CustomerSchema } from '@modules/customers/infrastructure/outbound/persistence/customer.schema';
import { CustomerMongooseRepository } from '@modules/customers/infrastructure/outbound/persistence/customer-mongoose.repository';
import { CreateCustomerController } from '@modules/customers/presentation/controllers/create-customer.controller';

export type CustomersModule = {
  createCustomerController: CreateCustomerController;
  createCustomer: CreateCustomerPort;
  router: Router;
};

type CustomersModuleDeps = {
  connection: Connection;
  authTokenMiddleware: RequestHandler;
  findIndicationOrigin: FindIndicationOriginPort;
};

export function makeCustomersModule({
  connection,
  authTokenMiddleware,
  findIndicationOrigin,
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

  const router = makeCustomerRoutes({
    createCustomerController,
    authTokenMiddleware,
  });

  return {
    createCustomerController,
    createCustomer,
    router,
  };
}
