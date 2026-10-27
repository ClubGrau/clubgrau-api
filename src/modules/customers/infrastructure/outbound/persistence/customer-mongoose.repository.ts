import { QueryFilter } from 'mongoose';
import { CreateCustomerResultDto } from '@modules/customers/application/dtos/create-customer.dto';
import {
  FindCustomersParams,
  FindCustomersResult,
  NameByIdReadModel,
} from '@modules/customers/application/dtos/get-customers.dto';
import { CreateCustomerRepositoryPort } from '@modules/customers/application/ports/outbound/create-customer-repository.port';
import { ExistsCustomerByIdPort } from '@modules/customers/application/ports/outbound/exists-customer-by-id.port';
import { FindCustomerNamesByIdsPort } from '@modules/customers/application/ports/outbound/find-customer-names-by-ids.port';
import { FindCustomersPort } from '@modules/customers/application/ports/outbound/find-customers.port';
import { CustomerAlreadyExistsError } from '@modules/customers/domain/errors/customer.errors';
import { FindCustomerByEmailPort } from '@modules/customers/domain/ports/find-customer-by-email.port';
import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { toObjectIds } from '@shared/infrastructure/adapters/mongoose/to-object-ids';
import {
  CustomerDocument,
  CustomerMongooseModel,
  CustomerSchemaType,
} from './customer.schema';
import {
  mapCustomerDocument,
  mapCustomerReadModel,
  mapToCreateDocument,
} from './customer.mapper';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class CustomerMongooseRepository
  implements
    FindCustomerByEmailPort,
    CreateCustomerRepositoryPort,
    ExistsCustomerByIdPort,
    FindCustomersPort,
    FindCustomerNamesByIdsPort
{
  constructor(private readonly customerModel: CustomerMongooseModel) {}

  async create(
    customer: CustomerModel.toCreate,
  ): Promise<CreateCustomerResultDto> {
    try {
      const createdCustomer = await this.customerModel.create(
        mapToCreateDocument(customer),
      );

      return { id: String(createdCustomer._id) };
    } catch (err) {
      if (this.isDuplicateKey(err)) {
        throw new CustomerAlreadyExistsError();
      }
      throw err;
    }
  }

  async findByEmail(email: string): Promise<CustomerModel.toCreate | null> {
    const customer = await this.customerModel.findOne({ email }).lean();
    if (!customer) return null;

    return mapCustomerDocument(customer as CustomerDocument);
  }

  async existsById(id: string): Promise<boolean> {
    try {
      const doc = await this.customerModel.exists({ _id: id });
      return doc != null;
    } catch {
      return false;
    }
  }

  async findAll(params: FindCustomersParams): Promise<FindCustomersResult> {
    const filter = this.buildFindFilter(params);
    const findCustomersQuery = this.customerModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .lean();

    const countDocumentsQuery = this.customerModel.countDocuments(filter);

    const [documents, total] = await Promise.all([
      findCustomersQuery,
      countDocumentsQuery,
    ]);

    return {
      items: (documents as CustomerDocument[]).map(mapCustomerReadModel),
      total,
    };
  }

  async findNamesByIds(ids: string[]): Promise<NameByIdReadModel[]> {
    const objectIds = toObjectIds(ids);
    if (objectIds.length === 0) {
      return [];
    }

    const documents = await this.customerModel
      .find({ _id: { $in: objectIds } })
      .select('_id name')
      .lean();

    return (documents as Pick<CustomerDocument, '_id' | 'name'>[]).map(
      (document) => ({
        id: String(document._id),
        name: document.name,
      }),
    );
  }

  private buildFindFilter(
    params: FindCustomersParams,
  ): QueryFilter<CustomerSchemaType> {
    const filter: QueryFilter<CustomerSchemaType> = {};

    if (params.rank) {
      filter.rank = params.rank;
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

  private isDuplicateKey(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    );
  }
}
