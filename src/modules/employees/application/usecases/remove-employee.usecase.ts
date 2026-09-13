import { randomBytes } from 'node:crypto';
import {
  ActorAuthenticationFailedError,
  EmployeeNotFoundError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeLifecyclePolicy } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import { Password } from '@shared/domain/value-object';
import {
  RemoveEmployeeDto,
  RemoveEmployeeResultDto,
} from '../dtos/remove-employee.dto';
import { EmployeeSnapshotMapper } from '../mappers/employee-snapshot.mapper';
import { RemoveEmployeePort } from '../ports/inbound/remove-employee.port';
import { AnonymizeEmployeeRepositoryPort } from '../ports/outbound/anonymize-employee-repository.port';
import { FindEmployeeByIdPort } from '../ports/outbound/find-employee-by-id.port';

export class RemoveEmployeeUsecase implements RemoveEmployeePort {
  constructor(
    private readonly findEmployeeById: FindEmployeeByIdPort,
    private readonly compareHash: CompareHashPort,
    private readonly encrypter: EncrypterPort,
    private readonly lifecyclePolicy: EmployeeLifecyclePolicy,
    private readonly anonymizeEmployee: AnonymizeEmployeeRepositoryPort,
  ) {}

  async execute(params: RemoveEmployeeDto): Promise<RemoveEmployeeResultDto> {
    const authError = new ActorAuthenticationFailedError();
    if (!params.actorId?.trim()) throw authError;

    const actorSnapshot = await this.findEmployeeById.findById(params.actorId);
    if (!actorSnapshot) throw authError;

    const passwordMatches = await this.compareActorPassword(
      params.actorPassword,
      actorSnapshot.password,
    );
    if (!passwordMatches) throw authError;

    const targetSnapshot = await this.findEmployeeById.findById(
      params.targetId,
    );
    if (!targetSnapshot) {
      throw new EmployeeNotFoundError();
    }

    const actor = EmployeeSnapshotMapper.toEntity(actorSnapshot);
    const target = EmployeeSnapshotMapper.toEntity(targetSnapshot);

    await this.lifecyclePolicy.assertCan({
      actor,
      target,
      intent: 'REMOVE',
    });

    const secret = randomBytes(32).toString('hex');
    const hash = await this.encrypter.encrypt(secret);

    target.anonymize();
    target.changePassword(Password.fromHash(hash));

    const snapshot = target.toJSON();
    await this.anonymizeEmployee.anonymize({
      id: target.id,
      name: snapshot.name,
      email: snapshot.email,
      phone: null,
      nif: null,
      password: hash,
      status: EmployeeModel.Status.REMOVED,
      removedAt: snapshot.removedAt as Date,
    });

    return { id: target.id };
  }

  private async compareActorPassword(
    actorPassword: string,
    actorHash: string,
  ): Promise<boolean> {
    try {
      return await this.compareHash.compare(actorPassword, actorHash);
    } catch {
      throw new ActorAuthenticationFailedError();
    }
  }
}
