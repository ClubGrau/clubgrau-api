import { Connection } from 'mongoose';
import { RequestHandler, Router } from 'express';
import { CreateEmployeePort } from '@modules/employees/application/ports/inbound/create-employee.port';
import { GetEmployeesPort } from '@modules/employees/application/ports/inbound/get-employees.port';
import { GetOwnEmployeePort } from '@modules/employees/application/ports/inbound/get-own-employee.port';
import { RemoveEmployeePort } from '@modules/employees/application/ports/inbound/remove-employee.port';
import { UpdateEmployeeStatusPort } from '@modules/employees/application/ports/inbound/update-employee-status.port';
import { UpdateMainEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-main-employee-data.port';
import { UpdateOwnEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-own-employee-data.port';
import { UpdatePersonalEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-personal-employee-data.port';
import { UpdateProfessionalEmployeeDataPort } from '@modules/employees/application/ports/inbound/update-professional-employee-data.port';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import { GetEmployeesQuery } from '@modules/employees/application/queries/get-employees.query';
import { GetOwnEmployeeQuery } from '@modules/employees/application/queries/get-own-employee.query';
import { CreateEmployeeUsecase } from '@modules/employees/application/usecases/create-employee.usecase';
import { RemoveEmployeeUsecase } from '@modules/employees/application/usecases/remove-employee.usecase';
import { UpdateEmployeeStatusUsecase } from '@modules/employees/application/usecases/update-employee-status.usecase';
import { UpdateMainEmployeeDataUsecase } from '@modules/employees/application/usecases/update-main-employee-data.usecase';
import { UpdateOwnEmployeeDataUsecase } from '@modules/employees/application/usecases/update-own-employee-data.usecase';
import { UpdatePersonalEmployeeDataUsecase } from '@modules/employees/application/usecases/update-personal-employee-data.usecase';
import { UpdateProfessionalEmployeeDataUsecase } from '@modules/employees/application/usecases/update-professional-employee-data.usecase';
import { EmployeeLifecyclePolicy } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { EmployeeMainDataPatchService } from '@modules/employees/domain/services/employee-main-data-patch.service';
import { EmployeeMainDataPolicy } from '@modules/employees/domain/services/employee-main-data.policy';
import { EmployeeOwnDataPatchService } from '@modules/employees/domain/services/employee-own-data-patch.service';
import { EmployeeOwnDataPolicy } from '@modules/employees/domain/services/employee-own-data.policy';
import { EmployeePersonalDataPatchService } from '@modules/employees/domain/services/employee-personal-data-patch.service';
import { EmployeePersonalDataPolicy } from '@modules/employees/domain/services/employee-personal-data.policy';
import { EmployeeProfessionalDataPatchService } from '@modules/employees/domain/services/employee-professional-data-patch.service';
import { EmployeeProfessionalDataPolicy } from '@modules/employees/domain/services/employee-professional-data.policy';
import { EmployeePoliciesService } from '@modules/employees/domain/services/employee-policies.service';
import { makeEmployeeRoutes } from '@modules/employees/infrastructure/inbound/http/employee.routes';
import { EmployeeSchema } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { EmployeeMongooseRepository } from '@modules/employees/infrastructure/outbound/persistence/employee-mongoose.repository';
import { EmploymentIdCounter } from '@modules/employees/infrastructure/outbound/persistence/employment-id-counter.mongoose';
import { EmploymentIdCounterSchema } from '@modules/employees/infrastructure/outbound/persistence/employment-id-counter.schema';
import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { GetEmployeesController } from '@modules/employees/presentation/controllers/get-employees.controller';
import { GetOwnEmployeeController } from '@modules/employees/presentation/controllers/get-own-employee.controller';
import { RemoveEmployeeController } from '@modules/employees/presentation/controllers/remove-employee.controller';
import { UpdateEmployeeStatusController } from '@modules/employees/presentation/controllers/update-employee-status.controller';
import { UpdateMainEmployeeDataController } from '@modules/employees/presentation/controllers/update-main-employee-data.controller';
import { UpdateOwnEmployeeDataController } from '@modules/employees/presentation/controllers/update-own-employee-data.controller';
import { UpdatePersonalEmployeeDataController } from '@modules/employees/presentation/controllers/update-personal-employee-data.controller';
import { UpdateProfessionalEmployeeDataController } from '@modules/employees/presentation/controllers/update-professional-employee-data.controller';

export type EmployeesModule = {
  createEmployeeController: CreateEmployeeController;
  getEmployeesController: GetEmployeesController;
  updateEmployeeStatusController: UpdateEmployeeStatusController;
  updateMainEmployeeDataController: UpdateMainEmployeeDataController;
  updatePersonalEmployeeDataController: UpdatePersonalEmployeeDataController;
  updateProfessionalEmployeeDataController: UpdateProfessionalEmployeeDataController;
  getOwnEmployeeController: GetOwnEmployeeController;
  updateOwnEmployeeDataController: UpdateOwnEmployeeDataController;
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
  const counterModel = connection.model(
    'EmploymentIdCounter',
    EmploymentIdCounterSchema,
  );
  const employeeRepository = new EmployeeMongooseRepository(employeeModel);
  const employeePoliciesService = new EmployeePoliciesService(
    employeeRepository,
  );
  const employmentIdCounter = new EmploymentIdCounter(
    employeeModel,
    counterModel,
  );

  const createEmployee: CreateEmployeePort = new CreateEmployeeUsecase(
    employeePoliciesService,
    encrypter,
    employeeRepository,
    employmentIdCounter,
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

  const personalDataPolicy = new EmployeePersonalDataPolicy();
  const personalDataPatchService = new EmployeePersonalDataPatchService();
  const updatePersonalEmployeeData: UpdatePersonalEmployeeDataPort =
    new UpdatePersonalEmployeeDataUsecase(
      employeeRepository,
      personalDataPolicy,
      personalDataPatchService,
      employeeRepository,
    );
  const updatePersonalEmployeeDataController =
    new UpdatePersonalEmployeeDataController(updatePersonalEmployeeData);

  const ownDataPolicy = new EmployeeOwnDataPolicy();
  const ownDataPatchService = new EmployeeOwnDataPatchService(
    personalDataPatchService,
  );
  const updateOwnEmployeeData: UpdateOwnEmployeeDataPort =
    new UpdateOwnEmployeeDataUsecase(
      employeeRepository,
      ownDataPolicy,
      ownDataPatchService,
      employeeRepository,
      employeeRepository,
    );
  const getOwnEmployee: GetOwnEmployeePort = new GetOwnEmployeeQuery(
    employeeRepository,
    ownDataPolicy,
  );
  const updateOwnEmployeeDataController = new UpdateOwnEmployeeDataController(
    updateOwnEmployeeData,
  );
  const getOwnEmployeeController = new GetOwnEmployeeController(getOwnEmployee);

  const professionalDataPolicy = new EmployeeProfessionalDataPolicy(
    employeeRepository,
  );
  const professionalDataPatchService =
    new EmployeeProfessionalDataPatchService();
  const updateProfessionalEmployeeData: UpdateProfessionalEmployeeDataPort =
    new UpdateProfessionalEmployeeDataUsecase(
      employeeRepository,
      professionalDataPolicy,
      professionalDataPatchService,
      lifecyclePolicy,
      employeeRepository,
    );
  const updateProfessionalEmployeeDataController =
    new UpdateProfessionalEmployeeDataController(
      updateProfessionalEmployeeData,
    );

  const requireRoles = makeRequireRoles;

  const router = makeEmployeeRoutes({
    createEmployeeController,
    getEmployeesController,
    updateEmployeeStatusController,
    updateMainEmployeeDataController,
    updatePersonalEmployeeDataController,
    updateProfessionalEmployeeDataController,
    getOwnEmployeeController,
    updateOwnEmployeeDataController,
    removeEmployeeController,
    authTokenMiddleware,
    requireRoles,
  });

  return {
    createEmployeeController,
    getEmployeesController,
    updateEmployeeStatusController,
    updateMainEmployeeDataController,
    updatePersonalEmployeeDataController,
    updateProfessionalEmployeeDataController,
    getOwnEmployeeController,
    updateOwnEmployeeDataController,
    removeEmployeeController,
    createEmployee,
    getEmployees,
    router,
  };
}
