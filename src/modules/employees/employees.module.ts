import { Connection } from 'mongoose';
import { RequestHandler, Router } from 'express';
import { CreateEmployeePort } from '@modules/employees/application/ports/inbound/create-employee.port';
import { GetEmployeesPort } from '@modules/employees/application/ports/inbound/get-employees.port';
import { GetEmployeesQuery } from '@modules/employees/application/queries/get-employees.query';
import { CreateEmployeeUsecase } from '@modules/employees/application/usecases/create-employee.usecase';
import { EmployeePoliciesService } from '@modules/employees/domain/services/employee-policies.service';
import { makeEmployeeRoutes } from '@modules/employees/infrastructure/inbound/http/employee.routes';
import { EmployeeSchema } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { EmployeeMongooseRepository } from '@modules/employees/infrastructure/outbound/persistence/employee-mongoose.repository';
import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { GetEmployeesController } from '@modules/employees/presentation/controllers/get-employees.controller';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';

export type EmployeesModule = {
  createEmployeeController: CreateEmployeeController;
  getEmployeesController: GetEmployeesController;
  createEmployee: CreateEmployeePort;
  getEmployees: GetEmployeesPort;
  router: Router;
};

type EmployeesModuleDeps = {
  connection: Connection;
  encrypter: EncrypterPort;
  authTokenMiddleware: RequestHandler;
};

export function makeEmployeesModule({
  connection,
  encrypter,
  authTokenMiddleware,
}: EmployeesModuleDeps): EmployeesModule {
  const employeeModel = connection.model('Employee', EmployeeSchema);
  const employeeRepository = new EmployeeMongooseRepository(employeeModel);
  const employeePoliciesService = new EmployeePoliciesService(
    employeeRepository,
  );

  const createEmployee: CreateEmployeePort = new CreateEmployeeUsecase(
    employeePoliciesService,
    encrypter,
    employeeRepository,
  );
  const getEmployees: GetEmployeesPort = new GetEmployeesQuery(
    employeeRepository,
  );

  const createEmployeeController = new CreateEmployeeController(createEmployee);
  const getEmployeesController = new GetEmployeesController(getEmployees);

  const router = makeEmployeeRoutes({
    createEmployeeController,
    getEmployeesController,
    authTokenMiddleware,
  });

  return {
    createEmployeeController,
    getEmployeesController,
    createEmployee,
    getEmployees,
    router,
  };
}
