import { Customer } from '@modules/customers/domain/entities/Customer';
import { CustomerPoliciesService } from '@modules/customers/domain/services/customer-policies.service';
import {
  CreateCustomerDto,
  CreateCustomerResultDto,
} from '../dtos/create-customer.dto';
import { CreateCustomerPort } from '../ports/inbound/create-customer.port';
import { CreateCustomerRepositoryPort } from '../ports/outbound/create-customer-repository.port';
import { ExistsCustomerByIdPort } from '../ports/outbound/exists-customer-by-id.port';
import { FindIndicationOriginPort } from '../ports/outbound/find-indication-origin.port';

export class CreateCustomerUsecase implements CreateCustomerPort {
  constructor(
    private readonly customerPoliciesService: CustomerPoliciesService,
    private readonly findIndicationOrigin: FindIndicationOriginPort,
    private readonly existsCustomerById: ExistsCustomerByIdPort,
    private readonly createCustomerRepository: CreateCustomerRepositoryPort,
  ) {}

  async execute(params: CreateCustomerDto): Promise<CreateCustomerResultDto> {
    const customer = Customer.create({
      name: params.name,
      email: params.email,
      phone: params.phone,
      nif: params.nif,
      indication: params.indication ?? null,
    });
    const snapshot = customer.toJSON();

    await this.customerPoliciesService.ensureEmailIsAvailable(snapshot.email);

    const { indication } = customer;
    // TODO: melhorar o tratamento de null
    if (indication !== null) {
      const link = indication.toJSON();
      if (link.categoryId === 'amigo') {
        const exists = await this.existsCustomerById.existsById(
          link.referrerCustomerId,
        );
        indication.ensureReferrerExists(exists);
      } else {
        const facts = await this.findIndicationOrigin.findOrigin(link.originId);
        indication.ensureOriginIsLinkable(facts);
      }
    }

    const { id } = await this.createCustomerRepository.create(snapshot);
    return { id };
  }
}
