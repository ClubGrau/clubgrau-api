import {
  CustomerAlreadyRemovedError,
  CustomerNotFoundError,
} from '@modules/customers/domain/errors/customer.errors';
import { CustomerPatchService } from '@modules/customers/domain/services/customer-patch.service';
import {
  UpdateCustomerDto,
  UpdateCustomerResultDto,
} from '../dtos/update-customer.dto';
import { CustomerSnapshotMapper } from '../mappers/customer-snapshot.mapper';
import { UpdateCustomerPort } from '../ports/inbound/update-customer.port';
import { FindCustomerByIdPort } from '../ports/outbound/find-customer-by-id.port';
import { UpdateCustomerRepositoryPort } from '../ports/outbound/update-customer-repository.port';
import { resolveCustomerUpdateChanges } from '../services/customer-update-changes.resolver';

export class UpdateCustomerUsecase implements UpdateCustomerPort {
  constructor(
    private readonly customerPatchService: CustomerPatchService,
    private readonly findCustomerById: FindCustomerByIdPort,
    private readonly updateCustomerRepository: UpdateCustomerRepositoryPort,
  ) {}

  async execute(params: UpdateCustomerDto): Promise<UpdateCustomerResultDto> {
    const changes = resolveCustomerUpdateChanges({
      name: params.name,
      email: params.email,
      phone: params.phone,
      nif: params.nif,
    });

    const snapshot = await this.findCustomerById.findById(params.id);
    if (snapshot === null) {
      throw new CustomerNotFoundError();
    }

    const customer = CustomerSnapshotMapper.toEntity(snapshot);
    const patch = await this.customerPatchService.apply(customer, changes);

    const updated = await this.updateCustomerRepository.update({
      id: customer.id,
      ...patch,
    });
    if (!updated) {
      throw new CustomerAlreadyRemovedError();
    }

    return { id: customer.id };
  }
}
