import { CreateEmployeeRepositoryPort } from '@modules/employees/application/ports/outbound/create-employee-repository.port';
import { FindEmployeeByEmailPort } from '@modules/employees/domain/ports/find-employee-by-email.port';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeDocument, EmployeeMongooseModel } from './employee.schema';
import { mapEmployeeDocument, mapToCreateDocument } from './employee.mapper';

export class EmployeeMongooseRepository
  implements FindEmployeeByEmailPort, CreateEmployeeRepositoryPort
{
  constructor(private readonly employeeModel: EmployeeMongooseModel) {}

  async create(
    employee: EmployeeModel.toCreate,
  ): Promise<EmployeeModel.CreateEmployeeResultDto> {
    const createdEmployee = await this.employeeModel.create(
      mapToCreateDocument(employee),
    );

    return { id: String(createdEmployee._id) };
  }

  async findByEmail(email: string): Promise<EmployeeModel.toCreate | null> {
    const employee = await this.employeeModel.findOne({ email }).lean();
    if (!employee) return null;

    return mapEmployeeDocument(employee as EmployeeDocument);
  }
}
