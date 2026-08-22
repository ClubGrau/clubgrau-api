import { CreateEmployeeResultDto } from '@modules/employees/application/dtos/create-employee.dto';
import {
  FindEmployeesParams,
  FindEmployeesResult,
} from '@modules/employees/application/dtos/get-employees.dto';
import {
  AnonymizeEmployeeParams,
  AnonymizeEmployeeRepositoryPort,
} from '@modules/employees/application/ports/outbound/anonymize-employee-repository.port';
import { CreateEmployeeRepositoryPort } from '@modules/employees/application/ports/outbound/create-employee-repository.port';
import { FindEmployeeByIdPort } from '@modules/employees/application/ports/outbound/find-employee-by-id.port';
import { FindEmployeesPort } from '@modules/employees/application/ports/outbound/find-employees.port';
import {
  UpdateEmployeeStatusParams,
  UpdateEmployeeStatusRepositoryPort,
} from '@modules/employees/application/ports/outbound/update-employee-status-repository.port';
import { CountNonRemovedAdminsPort } from '@modules/employees/domain/ports/count-non-removed-admins.port';
import { FindEmployeeByEmailPort } from '@modules/employees/domain/ports/find-employee-by-email.port';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { QueryFilter } from 'mongoose';
import {
  EmployeeDocument,
  EmployeeMongooseModel,
  EmployeeSchemaType,
} from './employee.schema';
import {
  mapEmployeeDocument,
  mapEmployeeReadModel,
  mapToCreateDocument,
} from './employee.mapper';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class EmployeeMongooseRepository
  implements
    FindEmployeeByEmailPort,
    FindEmployeeByIdPort,
    CreateEmployeeRepositoryPort,
    FindEmployeesPort,
    UpdateEmployeeStatusRepositoryPort,
    CountNonRemovedAdminsPort,
    AnonymizeEmployeeRepositoryPort
{
  constructor(private readonly employeeModel: EmployeeMongooseModel) {}

  async create(
    employee: EmployeeModel.toCreate,
  ): Promise<CreateEmployeeResultDto> {
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

  async findById(id: string): Promise<EmployeeModel.toCreate | null> {
    try {
      const employee = await this.employeeModel.findById(id).lean();
      if (!employee) return null;

      return mapEmployeeDocument(employee as EmployeeDocument);
    } catch {
      return null;
    }
  }

  async updateStatus(params: UpdateEmployeeStatusParams): Promise<void> {
    await this.employeeModel.updateOne(
      { _id: params.id },
      { $set: { status: params.status, deactivateAt: params.deactivateAt } },
    );
  }

  async countNonRemovedAdmins(): Promise<number> {
    return this.employeeModel.countDocuments({
      role: EmployeeModel.Role.ADMIN,
      status: { $ne: EmployeeModel.Status.REMOVED },
    });
  }

  async anonymize(params: AnonymizeEmployeeParams): Promise<void> {
    await this.employeeModel.updateOne(
      { _id: params.id },
      {
        $set: {
          name: params.name,
          email: params.email,
          phone: params.phone,
          nif: params.nif,
          password: params.password,
          status: params.status,
          removedAt: params.removedAt,
        },
      },
    );
  }

  async findAll(params: FindEmployeesParams): Promise<FindEmployeesResult> {
    const filter = this.buildFindFilter(params);

    const [documents, total] = await Promise.all([
      this.employeeModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(params.skip)
        .limit(params.limit)
        .lean(),
      this.employeeModel.countDocuments(filter),
    ]);

    return {
      items: (documents as EmployeeDocument[]).map(mapEmployeeReadModel),
      total,
    };
  }

  private buildFindFilter(
    params: FindEmployeesParams,
  ): QueryFilter<EmployeeSchemaType> {
    const filter: QueryFilter<EmployeeSchemaType> = {};

    if (params.status) {
      filter.status = { $eq: params.status, $ne: EmployeeModel.Status.REMOVED };
    } else {
      filter.status = { $ne: EmployeeModel.Status.REMOVED };
    }
    if (params.role) {
      filter.role = params.role;
    }
    if (params.search) {
      const pattern = escapeRegex(params.search);
      filter.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: { $ifNull: ['$nif', ''] } },
              regex: pattern,
              options: 'i',
            },
          },
        },
      ];
    }

    return filter;
  }
}
