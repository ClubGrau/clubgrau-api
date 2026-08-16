import { Employee } from '../entities/Employee';

/**
 * Conceitos de domínio do Employee.
 * DTOs de entrada/saída de casos de uso ficam em application/dtos.
 */
export namespace EmployeeModel {
  export enum Role {
    ADMIN = 'ADMIN',
    MANAGER = 'MANAGER',
    EMPLOYEE = 'EMPLOYEE',
  }

  export enum Status {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    VACATION = 'VACATION',
  }

  /** Snapshot serializado da entidade (persistência / ports de saída). */
  export type toCreate = ReturnType<Employee['toJSON']>;

  export const ROLES: readonly Role[] = Object.freeze(Object.values(Role));

  export const STATUSES: readonly Status[] = Object.freeze(
    Object.values(Status),
  );

  export function isRole(value: unknown): value is Role {
    return typeof value === 'string' && (ROLES as string[]).includes(value);
  }

  export function isStatus(value: unknown): value is Status {
    return typeof value === 'string' && (STATUSES as string[]).includes(value);
  }
}
