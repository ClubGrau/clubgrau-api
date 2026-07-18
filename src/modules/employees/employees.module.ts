import { Connection } from 'mongoose';
import { Router } from 'express';
import { CreateEmployeeUsecase } from '@modules/employees/application/usecases/create-employee.usecase';
import { EmployeePoliciesService } from '@modules/employees/domain/services/employee-policies.service';
import { EmployeeSchema } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { EmployeeMongooseRepository } from '@modules/employees/infrastructure/outbound/persistence/employee-mongoose.repository';
import { CreateEmployeeController } from '@modules/employees/presentation/controllers/create-employee.controller';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import { makeEmployeeRoutes } from '@modules/employees/infrastructure/inbound/http/employee.routes';

export type EmployeesModule = {
  createEmployeeController: CreateEmployeeController;
  createEmployeeUsecase: CreateEmployeeUsecase;
  router: Router;
};

type EmployeesModuleDeps = {
  connection: Connection;
  encrypter: EncrypterPort;
};

export function makeEmployeesModule({
  connection,
  encrypter,
}: EmployeesModuleDeps): EmployeesModule {
  const employeeModel = connection.model('Employee', EmployeeSchema);
  const employeeRepository = new EmployeeMongooseRepository(employeeModel);
  const employeePoliciesService = new EmployeePoliciesService(
    employeeRepository,
  );

  const createEmployeeUsecase = new CreateEmployeeUsecase(
    employeePoliciesService,
    encrypter,
    employeeRepository,
  );

  const createEmployeeController = new CreateEmployeeController(
    createEmployeeUsecase,
  );

  return {
    createEmployeeController,
    createEmployeeUsecase,
    router: makeEmployeeRoutes({ createEmployeeController }),
  };
}
