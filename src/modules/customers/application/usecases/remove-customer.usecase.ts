import {
  CustomerActorAuthenticationFailedError,
  CustomerAlreadyRemovedError,
  CustomerNotFoundError,
} from '@modules/customers/domain/errors/customer.errors';
import {
  RemoveCustomerDto,
  RemoveCustomerResultDto,
} from '../dtos/remove-customer.dto';
import { CustomerSnapshotMapper } from '../mappers/customer-snapshot.mapper';
import { RemoveCustomerPort } from '../ports/inbound/remove-customer.port';
import { FindCustomerByIdPort } from '../ports/outbound/find-customer-by-id.port';
import { RemoveCustomerRepositoryPort } from '../ports/outbound/remove-customer-repository.port';
import { VerifyActorPasswordPort } from '../ports/outbound/verify-actor-password.port';

export class RemoveCustomerUsecase implements RemoveCustomerPort {
  constructor(
    private readonly verifyActorPassword: VerifyActorPasswordPort,
    private readonly findCustomerById: FindCustomerByIdPort,
    private readonly removeCustomerRepository: RemoveCustomerRepositoryPort,
  ) {}

  async execute(params: RemoveCustomerDto): Promise<RemoveCustomerResultDto> {
    const actorId = params.actorId;
    if (!actorId?.trim()) {
      throw new CustomerActorAuthenticationFailedError();
    }

    const passwordMatches = await this.verifyActorPassword.verify(
      actorId,
      params.actorPassword,
    );
    if (!passwordMatches) {
      throw new CustomerActorAuthenticationFailedError();
    }

    const snapshot = await this.findCustomerById.findById(params.customerId);
    if (snapshot === null) {
      throw new CustomerNotFoundError();
    }

    const customer = CustomerSnapshotMapper.toEntity(snapshot);
    customer.remove(new Date());

    const removed = await this.removeCustomerRepository.remove(
      customer.toJSON(),
    );
    if (!removed) {
      throw new CustomerAlreadyRemovedError();
    }

    return { id: customer.id };
  }
}
