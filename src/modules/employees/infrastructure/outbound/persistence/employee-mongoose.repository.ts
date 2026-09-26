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
import {
  UpdateMainEmployeeDataParams,
  UpdateMainEmployeeDataRepositoryPort,
} from '@modules/employees/application/ports/outbound/update-main-employee-data-repository.port';
import {
  UpdatePersonalEmployeeDataParams,
  UpdatePersonalEmployeeDataRepositoryPort,
} from '@modules/employees/application/ports/outbound/update-personal-employee-data-repository.port';
import {
  UpdateProfessionalEmployeeDataParams,
  UpdateProfessionalEmployeeDataRepositoryPort,
} from '@modules/employees/application/ports/outbound/update-professional-employee-data-repository.port';
import { CountActiveAdminsPort } from '@modules/employees/domain/ports/count-active-admins.port';
import { CountLoginCapableAdminsPort } from '@modules/employees/domain/ports/count-login-capable-admins.port';
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
    CountActiveAdminsPort,
    CountLoginCapableAdminsPort,
    AnonymizeEmployeeRepositoryPort,
    UpdateMainEmployeeDataRepositoryPort,
    UpdatePersonalEmployeeDataRepositoryPort,
    UpdateProfessionalEmployeeDataRepositoryPort
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

  async updateMainData(params: UpdateMainEmployeeDataParams): Promise<void> {
    const { id, ...fields } = params;
    const $set = this.buildUpdateFilterEntries(fields);
    const result = await this.employeeModel.updateOne({ _id: id }, { $set });
    if (result.matchedCount === 0) {
      throw new Error('Employee main data update matched 0 documents');
    }
  }

  async updatePersonalData(
    params: UpdatePersonalEmployeeDataParams,
  ): Promise<void> {
    const { id, ...fields } = params;
    const $set: Record<string, string | number | null> =
      this.buildUpdateFilterEntries(fields);
    if ('nif' in $set && $set.nif !== null) {
      $set.nif = Number($set.nif);
    }
    const result = await this.employeeModel.updateOne({ _id: id }, { $set });
    if (result.matchedCount === 0) {
      throw new Error('Employee personal data update matched 0 documents');
    }
  }

  async countNonRemovedAdmins(): Promise<number> {
    return this.employeeModel.countDocuments({
      role: EmployeeModel.Role.ADMIN,
      status: { $ne: EmployeeModel.Status.REMOVED },
    });
  }

  async countActiveAdmins(): Promise<number> {
    return this.employeeModel.countDocuments({
      role: EmployeeModel.Role.ADMIN,
      status: EmployeeModel.Status.ACTIVE,
    });
  }

  async countLoginCapableAdmins(): Promise<number> {
    return this.employeeModel.countDocuments({
      role: EmployeeModel.Role.ADMIN,
      status: {
        $in: [EmployeeModel.Status.ACTIVE, EmployeeModel.Status.VACATION],
      },
    });
  }

  async updateProfessionalData(
    params: UpdateProfessionalEmployeeDataParams,
  ): Promise<void> {
    const { id, ...fields } = params;
    const filteredFields = fields as Omit<
      UpdateProfessionalEmployeeDataParams,
      'deactivateAt'
    >;
    const $set = this.buildUpdateFilterEntries(filteredFields);
    const result = await this.employeeModel.updateOne({ _id: id }, { $set });
    if (result.matchedCount === 0) {
      throw new Error('Employee professional data update matched 0 documents');
    }
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

  private buildUpdateFilterEntries<
    T extends Record<string, string | number | null>,
  >(params: Omit<T, 'id'>): Record<string, string | number | null> {
    return Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined),
    );
  }
}
