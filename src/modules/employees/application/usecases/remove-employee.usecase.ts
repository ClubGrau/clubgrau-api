import { randomBytes } from 'node:crypto';
import { Employee } from '@modules/employees/domain/entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeNotFoundError,
} from '@modules/employees/domain/errors/employee.errors';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeLifecyclePolicy } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { CompareHashPort } from '@shared/application/ports/compare-hash.port';
import { EncrypterPort } from '@shared/application/ports/encrypter.port';
import { Email, Name, Nif, Password, Phone } from '@shared/domain/value-object';
import {
  RemoveEmployeeDto,
  RemoveEmployeeResultDto,
} from '../dtos/remove-employee.dto';
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

    const actor = this.reconstitute(actorSnapshot);
    const target = this.reconstitute(targetSnapshot);

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

  private reconstitute(snapshot: EmployeeModel.toCreate): Employee {
    return Employee.reconstitute({
      id: snapshot.id,
      name: Name.create(snapshot.name),
      email: Email.create(snapshot.email),
      password: Password.fromHash(snapshot.password),
      phone: snapshot.phone ? Phone.create(snapshot.phone) : null,
      nif: snapshot.nif ? Nif.create(snapshot.nif) : null,
      role: snapshot.role,
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      deactivateAt: snapshot.deactivateAt,
      removedAt: snapshot.removedAt ?? null,
    });
  }
}
