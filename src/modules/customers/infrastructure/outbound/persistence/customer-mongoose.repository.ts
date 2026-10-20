import { CreateCustomerResultDto } from '@modules/customers/application/dtos/create-customer.dto';
import { CreateCustomerRepositoryPort } from '@modules/customers/application/ports/outbound/create-customer-repository.port';
import { ExistsCustomerByIdPort } from '@modules/customers/application/ports/outbound/exists-customer-by-id.port';
import { CustomerAlreadyExistsError } from '@modules/customers/domain/errors/customer.errors';
import { FindCustomerByEmailPort } from '@modules/customers/domain/ports/find-customer-by-email.port';
import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { CustomerDocument, CustomerMongooseModel } from './customer.schema';
import { mapCustomerDocument, mapToCreateDocument } from './customer.mapper';

export class CustomerMongooseRepository
  implements
    FindCustomerByEmailPort,
    CreateCustomerRepositoryPort,
    ExistsCustomerByIdPort
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

  private isDuplicateKey(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    );
  }
}
