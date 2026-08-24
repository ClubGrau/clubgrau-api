import { Email, Name, Password } from '@shared/domain/value-object';
import { Employee, ReconstituteEmployeeProps } from '../entities/Employee';
import {
  ActorAuthenticationFailedError,
  EmployeeAlreadyRemovedError,
  EmployeeLifecycleForbiddenError,
  EmployeeNotInactiveError,
  LastAdminProtectedError,
} from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { CountActiveAdminsPort } from '../ports/count-active-admins.port';
import { CountNonRemovedAdminsPort } from '../ports/count-non-removed-admins.port';
import {
  EmployeeLifecyclePolicy,
  LifecycleIntent,
} from './employee-lifecycle.policy';

const FIXED_ID = '507f1f77bcf86cd799439011';
const FIXED_ID_2 = '507f1f77bcf86cd799439022';

const makeEmployee = (
  overrides: Partial<ReconstituteEmployeeProps> & { id?: string } = {},
): Employee => {
  const id = overrides.id ?? FIXED_ID;
  return Employee.reconstitute({
    id,
    name: Name.create('John Doe'),
    email: Email.create('john@example.com'),
    password: Password.fromHash('$2b$10$hashedvalue'),
    phone: null,
    nif: null,
    role: EmployeeModel.Role.EMPLOYEE,
    status: EmployeeModel.Status.ACTIVE,
    createdAt: new Date(),
    deactivateAt: null,
    ...overrides,
  });
};

type CountAdminsPort = CountNonRemovedAdminsPort & CountActiveAdminsPort;

type SutTypes = {
  sut: EmployeeLifecyclePolicy;
  countPort: jest.Mocked<CountAdminsPort>;
};

const makeStubs = (): SutTypes => {
  const countPort: jest.Mocked<CountAdminsPort> = {
    countNonRemovedAdmins: jest.fn().mockResolvedValue(2),
    countActiveAdmins: jest.fn().mockResolvedValue(2),
  };
  const sut = new EmployeeLifecyclePolicy(countPort);
  return { sut, countPort };
};

const expectNoCount = (countPort: jest.Mocked<CountAdminsPort>): void => {
  expect(countPort.countNonRemovedAdmins).not.toHaveBeenCalled();
  expect(countPort.countActiveAdmins).not.toHaveBeenCalled();
};

describe('EmployeeLifecyclePolicy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeStubs();
    expect(sut).toBeInstanceOf(EmployeeLifecyclePolicy);
  });

  describe('Rule 1: Actor must be ACTIVE', () => {
    it.each([
      EmployeeModel.Status.INACTIVE,
      EmployeeModel.Status.VACATION,
      EmployeeModel.Status.REMOVED,
    ])(
      'should throw ActorAuthenticationFailedError when actor is %s',
      async (actorStatus) => {
        const { sut, countPort } = makeStubs();
        const actor = makeEmployee({
          role: EmployeeModel.Role.ADMIN,
          status: actorStatus,
        });
        const target = makeEmployee({ id: FIXED_ID_2 });

        await expect(
          sut.assertCan({ actor, target, intent: 'DEACTIVATE' }),
        ).rejects.toThrow(ActorAuthenticationFailedError);
        expectNoCount(countPort);
      },
    );
  });

  describe('Rule 2: Self-Remove', () => {
    it('should throw EmployeeLifecycleForbiddenError when actor tries to remove themselves', async () => {
      const { sut, countPort } = makeStubs();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: actor.id,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).rejects.toThrow(EmployeeLifecycleForbiddenError);
      expectNoCount(countPort);
    });
  });

  describe('Rule 3: Target already REMOVED', () => {
    it.each<LifecycleIntent>([
      'DEACTIVATE',
      'REACTIVATE',
      'VACATION',
      'REMOVE',
    ])(
      'should throw EmployeeAlreadyRemovedError for intent %s on a REMOVED target',
      async (intent) => {
        const { sut } = makeStubs();
        const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
        const target = makeEmployee({
          id: FIXED_ID_2,
          status: EmployeeModel.Status.REMOVED,
        });

        await expect(sut.assertCan({ actor, target, intent })).rejects.toThrow(
          EmployeeAlreadyRemovedError,
        );
      },
    );
  });

  describe('Rule 4: Role matrix — EMPLOYEE actor', () => {
    it.each<LifecycleIntent>([
      'DEACTIVATE',
      'REACTIVATE',
      'VACATION',
      'REMOVE',
    ])(
      'should throw EmployeeLifecycleForbiddenError for EMPLOYEE actor with intent %s',
      async (intent) => {
        const { sut, countPort } = makeStubs();
        const actor = makeEmployee({ role: EmployeeModel.Role.EMPLOYEE });
        const target = makeEmployee({ id: FIXED_ID_2 });

        await expect(sut.assertCan({ actor, target, intent })).rejects.toThrow(
          EmployeeLifecycleForbiddenError,
        );
        expectNoCount(countPort);
      },
    );
  });

  describe('Rule 4: Role matrix — MANAGER actor', () => {
    it.each<LifecycleIntent>(['DEACTIVATE', 'REACTIVATE', 'VACATION'])(
      'should allow MANAGER to %s an EMPLOYEE target',
      async (intent) => {
        const { sut, countPort } = makeStubs();
        const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: EmployeeModel.Role.EMPLOYEE,
          status:
            intent === 'REACTIVATE'
              ? EmployeeModel.Status.INACTIVE
              : EmployeeModel.Status.ACTIVE,
        });

        await expect(
          sut.assertCan({ actor, target, intent }),
        ).resolves.toBeUndefined();
        expectNoCount(countPort);
      },
    );

    it('should throw EmployeeLifecycleForbiddenError when MANAGER tries to REMOVE an EMPLOYEE', async () => {
      const { sut, countPort } = makeStubs();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).rejects.toThrow(EmployeeLifecycleForbiddenError);
      expectNoCount(countPort);
    });

    it.each<LifecycleIntent>([
      'DEACTIVATE',
      'REACTIVATE',
      'VACATION',
      'REMOVE',
    ])(
      'should throw EmployeeLifecycleForbiddenError when MANAGER acts on MANAGER target with intent %s',
      async (intent) => {
        const { sut, countPort } = makeStubs();
        const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: EmployeeModel.Role.MANAGER,
        });

        await expect(sut.assertCan({ actor, target, intent })).rejects.toThrow(
          EmployeeLifecycleForbiddenError,
        );
        expectNoCount(countPort);
      },
    );

    it.each<LifecycleIntent>([
      'DEACTIVATE',
      'REACTIVATE',
      'VACATION',
      'REMOVE',
    ])(
      'should throw EmployeeLifecycleForbiddenError when MANAGER acts on ADMIN target with intent %s',
      async (intent) => {
        const { sut, countPort } = makeStubs();
        const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: EmployeeModel.Role.ADMIN,
        });

        await expect(sut.assertCan({ actor, target, intent })).rejects.toThrow(
          EmployeeLifecycleForbiddenError,
        );
        expectNoCount(countPort);
      },
    );
  });

  describe('Rule 4: Role matrix — ADMIN actor', () => {
    it.each<{ targetRole: EmployeeModel.Role; intent: LifecycleIntent }>([
      { targetRole: EmployeeModel.Role.EMPLOYEE, intent: 'DEACTIVATE' },
      { targetRole: EmployeeModel.Role.EMPLOYEE, intent: 'REACTIVATE' },
      { targetRole: EmployeeModel.Role.EMPLOYEE, intent: 'VACATION' },
      { targetRole: EmployeeModel.Role.MANAGER, intent: 'DEACTIVATE' },
      { targetRole: EmployeeModel.Role.MANAGER, intent: 'REACTIVATE' },
      { targetRole: EmployeeModel.Role.MANAGER, intent: 'VACATION' },
    ])(
      'should allow ADMIN to $intent a $targetRole target',
      async ({ targetRole, intent }) => {
        const { sut } = makeStubs();
        const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: targetRole,
          status:
            intent === 'REACTIVATE'
              ? EmployeeModel.Status.INACTIVE
              : EmployeeModel.Status.ACTIVE,
        });

        await expect(
          sut.assertCan({ actor, target, intent }),
        ).resolves.toBeUndefined();
      },
    );

    it('should allow ADMIN to REMOVE an INACTIVE EMPLOYEE target', async () => {
      const { sut } = makeStubs();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).resolves.toBeUndefined();
    });

    it('should allow ADMIN to REMOVE an INACTIVE MANAGER target', async () => {
      const { sut } = makeStubs();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.MANAGER,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).resolves.toBeUndefined();
    });

    it('should throw EmployeeNotInactiveError when ADMIN tries to REMOVE an ACTIVE target', async () => {
      const { sut } = makeStubs();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
        status: EmployeeModel.Status.ACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).rejects.toThrow(EmployeeNotInactiveError);
    });

    it('should throw EmployeeNotInactiveError when ADMIN tries to REMOVE a VACATION target', async () => {
      const { sut } = makeStubs();
      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.EMPLOYEE,
        status: EmployeeModel.Status.VACATION,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).rejects.toThrow(EmployeeNotInactiveError);
    });
  });

  describe('Rule 5: Last Admin protection', () => {
    it.each<LifecycleIntent>(['DEACTIVATE', 'VACATION'])(
      'should throw LastAdminProtectedError when the last ACTIVE ADMIN would leave ACTIVE via %s',
      async (intent) => {
        const { sut, countPort } = makeStubs();
        countPort.countActiveAdmins.mockResolvedValue(1);
        countPort.countNonRemovedAdmins.mockResolvedValue(2);

        const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: EmployeeModel.Role.ADMIN,
          status: EmployeeModel.Status.ACTIVE,
        });

        await expect(sut.assertCan({ actor, target, intent })).rejects.toThrow(
          LastAdminProtectedError,
        );
        expect(countPort.countActiveAdmins).toHaveBeenCalledTimes(1);
        expect(countPort.countNonRemovedAdmins).not.toHaveBeenCalled();
      },
    );

    it('should throw LastAdminProtectedError on REMOVE when countNonRemovedAdmins === 1', async () => {
      const { sut, countPort } = makeStubs();
      countPort.countNonRemovedAdmins.mockResolvedValue(1);

      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).rejects.toThrow(LastAdminProtectedError);
      expect(countPort.countNonRemovedAdmins).toHaveBeenCalledTimes(1);
      expect(countPort.countActiveAdmins).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to REACTIVATE an INACTIVE ADMIN without calling count', async () => {
      const { sut, countPort } = makeStubs();
      countPort.countNonRemovedAdmins.mockResolvedValue(1);
      countPort.countActiveAdmins.mockResolvedValue(1);

      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REACTIVATE' }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it('should allow ADMIN to REMOVE an INACTIVE ADMIN when countNonRemovedAdmins === 2', async () => {
      const { sut, countPort } = makeStubs();
      countPort.countNonRemovedAdmins.mockResolvedValue(2);
      countPort.countActiveAdmins.mockResolvedValue(1);

      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).resolves.toBeUndefined();
      expect(countPort.countNonRemovedAdmins).toHaveBeenCalledTimes(1);
      expect(countPort.countActiveAdmins).not.toHaveBeenCalled();
    });

    it('should allow DEACTIVATE of a VACATION ADMIN when another ADMIN is still ACTIVE', async () => {
      const { sut, countPort } = makeStubs();
      countPort.countActiveAdmins.mockResolvedValue(1);
      countPort.countNonRemovedAdmins.mockResolvedValue(2);

      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.VACATION,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'DEACTIVATE' }),
      ).resolves.toBeUndefined();
      expectNoCount(countPort);
    });

    it.each<LifecycleIntent>(['DEACTIVATE', 'VACATION'])(
      'should allow %s of an ADMIN when another ADMIN is still ACTIVE',
      async (intent) => {
        const { sut, countPort } = makeStubs();
        countPort.countActiveAdmins.mockResolvedValue(2);

        const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
        const target = makeEmployee({
          id: FIXED_ID_2,
          role: EmployeeModel.Role.ADMIN,
          status: EmployeeModel.Status.ACTIVE,
        });

        await expect(
          sut.assertCan({ actor, target, intent }),
        ).resolves.toBeUndefined();
        expect(countPort.countActiveAdmins).toHaveBeenCalledTimes(1);
        expect(countPort.countNonRemovedAdmins).not.toHaveBeenCalled();
      },
    );
  });

  describe('Count port not called for matrix refusals', () => {
    it('should not call count port when EMPLOYEE actor is rejected', async () => {
      const { sut, countPort } = makeStubs();
      const actor = makeEmployee({ role: EmployeeModel.Role.EMPLOYEE });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'DEACTIVATE' }),
      ).rejects.toThrow(EmployeeLifecycleForbiddenError);
      expectNoCount(countPort);
    });

    it('should not call count port when MANAGER actor is rejected for acting on MANAGER target', async () => {
      const { sut, countPort } = makeStubs();
      const actor = makeEmployee({ role: EmployeeModel.Role.MANAGER });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.MANAGER,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'DEACTIVATE' }),
      ).rejects.toThrow(EmployeeLifecycleForbiddenError);
      expectNoCount(countPort);
    });
  });

  describe('Count port rejection propagation', () => {
    it('should propagate the error thrown by countActiveAdmins on DEACTIVATE', async () => {
      const { sut, countPort } = makeStubs();
      const dbError = new Error('Database connection failed');
      countPort.countActiveAdmins.mockRejectedValue(dbError);

      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.ACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'DEACTIVATE' }),
      ).rejects.toThrow(dbError);
    });

    it('should propagate the error thrown by countNonRemovedAdmins on REMOVE', async () => {
      const { sut, countPort } = makeStubs();
      const dbError = new Error('Database connection failed');
      countPort.countNonRemovedAdmins.mockRejectedValue(dbError);

      const actor = makeEmployee({ role: EmployeeModel.Role.ADMIN });
      const target = makeEmployee({
        id: FIXED_ID_2,
        role: EmployeeModel.Role.ADMIN,
        status: EmployeeModel.Status.INACTIVE,
      });

      await expect(
        sut.assertCan({ actor, target, intent: 'REMOVE' }),
      ).rejects.toThrow(dbError);
    });
  });
});
