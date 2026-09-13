import { Connection } from 'mongoose';
import { RequestHandler, Router } from 'express';
import { CreateEmployeePort } from '@modules/employees/application/ports/inbound/create-employee.port';
import { GetEmployeesPort } from '@modules/employees/application/ports/inbound/get-employees.port';
import { RemoveEmployeePort } from '@modules/employees/application/ports/inbound/remove-employee.port';
import { UpdateEmployeeStatusPort } from '@modules/employees/application/ports/inbound/update-employee-status.port';
import { UpdateMainEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-main-employee-data.port';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import { GetEmployeesQuery } from '@modules/employees/application/queries/get-employees.query';
import { CreateEmployeeUsecase } from '@modules/employees/application/usecases/create-employee.usecase';
import { RemoveEmployeeUsecase } from '@modules/employees/application/usecases/remove-employee.usecase';
import { UpdateEmployeeStatusUsecase } from '@modules/employees/application/usecases/update-employee-status.usecase';
import { UpdateMainEmployeeDataUsecase } from '@modules/employees/application/usecases/update-main-employee-data.usecase';
import { EmployeeLifecyclePolicy } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { EmployeeMainDataPatchService } from '@modules/employees/domain/services/employee-main-data-patch.service';
import { EmployeeMainDataPolicy } from '@modules/employees/domain/services/employee-main-data.policy';
import { EmployeePoliciesService } from '@modules/employees/domain/services/employee-policies.service';
import { makeEmployeeRoutes } from '@modules/employees/infrastructure/inbound/http/employee.routes';
import { EmployeeSchema } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { EmployeeMongooseRepository } from '@modules/employees/infrastructure/outbound/persistence/employee-mongoose.repository';
import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { GetEmployeesController } from '@modules/employees/presentation/controllers/get-employees.controller';
import { RemoveEmployeeController } from '@modules/employees/presentation/controllers/remove-employee.controller';
import { UpdateEmployeeStatusController } from '@modules/employees/presentation/controllers/update-employee-status.controller';
import { UpdateMainEmployeeDataController } from '@modules/employees/presentation/controllers/update-main-employee-data.controller';

export type EmployeesModule = {
  createEmployeeController: CreateEmployeeController;
  getEmployeesController: GetEmployeesController;
  updateEmployeeStatusController: UpdateEmployeeStatusController;
  updateMainEmployeeDataController: UpdateMainEmployeeDataController;
  removeEmployeeController: RemoveEmployeeController;
  createEmployee: CreateEmployeePort;
  getEmployees: GetEmployeesPort;
  router: Router;
};

type EmployeesModuleDeps = {
  connection: Connection;
  encrypter: EncrypterPort;
  compareHash: CompareHashPort;
  authTokenMiddleware: RequestHandler;
  makeRequireRoles: (...roles: string[]) => RequestHandler;
};

export function makeEmployeesModule({
  connection,
  encrypter,
  compareHash,
  authTokenMiddleware,
  makeRequireRoles,
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

  const lifecyclePolicy = new EmployeeLifecyclePolicy(employeeRepository);
  const updateEmployeeStatus: UpdateEmployeeStatusPort =
    new UpdateEmployeeStatusUsecase(
      employeeRepository,
      employeeRepository,
      lifecyclePolicy,
    );
  const updateEmployeeStatusController = new UpdateEmployeeStatusController(
    updateEmployeeStatus,
  );

  const removeEmployee: RemoveEmployeePort = new RemoveEmployeeUsecase(
    employeeRepository,
    compareHash,
    encrypter,
    lifecyclePolicy,
    employeeRepository,
  );
  const removeEmployeeController = new RemoveEmployeeController(removeEmployee);

  const mainDataPatchService = new EmployeeMainDataPatchService(
    employeePoliciesService,
  );
  const mainDataPolicy = new EmployeeMainDataPolicy();
  const updateMainEmployeeData: UpdateMainEmployeeDataPort =
    new UpdateMainEmployeeDataUsecase(
      employeeRepository,
      mainDataPatchService,
      mainDataPolicy,
      employeeRepository,
    );
  const updateMainEmployeeDataController = new UpdateMainEmployeeDataController(
    updateMainEmployeeData,
  );

  const requireRoles = makeRequireRoles;

  const router = makeEmployeeRoutes({
    createEmployeeController,
    getEmployeesController,
    updateEmployeeStatusController,
    updateMainEmployeeDataController,
    removeEmployeeController,
    authTokenMiddleware,
    requireRoles,
  });

  return {
    createEmployeeController,
    getEmployeesController,
    updateEmployeeStatusController,
    updateMainEmployeeDataController,
    removeEmployeeController,
    createEmployee,
    getEmployees,
    router,
  };
}
