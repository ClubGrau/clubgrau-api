import { Customer } from '@modules/customers/domain/entities/Customer';
import { CustomerPoliciesService } from '@modules/customers/domain/services/customer-policies.service';
import {
  CreateCustomerDto,
  CreateCustomerResultDto,
} from '../dtos/create-customer.dto';
import { CreateCustomerPort } from '../ports/inbound/create-customer.port';
import { CreateCustomerRepositoryPort } from '../ports/outbound/create-customer-repository.port';

export class CreateCustomerUsecase implements CreateCustomerPort {
  constructor(
    private readonly customerPoliciesService: CustomerPoliciesService,
    private readonly createCustomerRepository: CreateCustomerRepositoryPort,
  ) {}

  async execute(params: CreateCustomerDto): Promise<CreateCustomerResultDto> {
    const customerToCreate = Customer.create({
      name: params.name,
      email: params.email,
      phone: params.phone,
      nif: params.nif,
    }).toJSON();

    await this.customerPoliciesService.ensureEmailIsAvailable(
      customerToCreate.email,
    );

    const { id } = await this.createCustomerRepository.create(customerToCreate);
    return { id };
  }
}
