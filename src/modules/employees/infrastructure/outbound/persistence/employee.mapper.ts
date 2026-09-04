import mongoose from 'mongoose';
import { GetEmployeesItemDto } from '@modules/employees/application/dtos/get-employees.dto';
import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { EmployeeDocument } from './employee.schema';

/** Maps a lean Mongoose document to the application persistence DTO. */
export function mapEmployeeDocument(
  document: EmployeeDocument,
): EmployeeModel.toCreate {
  return {
    id: String(document._id),
    name: document.name,
    email: document.email,
    password: document.password,
    role: document.role as EmployeeModel.Role,
    phone: document.phone ?? null,
    nif: document.nif != null ? String(document.nif) : null,
    status: document.status as EmployeeModel.Status,
    username: document.username ?? null,
    gender: document.gender ?? null,
    address: document.address ?? null,
    languages: document.languages ?? null,
    emergencyContact: document.emergencyContact ?? null,
    employmentId: document.employmentId ?? null,
    jobTitle: document.jobTitle ?? null,
    createdAt: document.createdAt ?? new Date(0),
    deactivateAt: document.deactivateAt ?? null,
    removedAt: document.removedAt ?? null,
  };
}

/** Maps a lean Mongoose document to the GetEmployees read model (no password). */
export function mapEmployeeReadModel(
  document: EmployeeDocument,
): GetEmployeesItemDto {
  return {
    id: String(document._id),
    name: document.name,
    email: document.email,
    role: document.role as EmployeeModel.Role,
    phone: document.phone ?? null,
    nif: document.nif != null ? String(document.nif) : null,
    status: document.status as EmployeeModel.Status,
    username: document.username ?? null,
    gender: document.gender ?? null,
    address: document.address ?? null,
    languages: document.languages ?? null,
    emergencyContact: document.emergencyContact ?? null,
    employmentId: document.employmentId ?? null,
    jobTitle: document.jobTitle ?? null,
    createdAt: document.createdAt ?? new Date(0),
    deactivateAt: document.deactivateAt ?? null,
  };
}

/**
 * Maps the application DTO to the Mongoose persistence payload.
 *
 * `sessionVersion` is intentionally omitted so Mongo applies the schema
 * default (`0`) on insert. Emitting a full-document `0` here would let a
 * later create/overwrite resurrect invalidated JWTs (ADR 0008).
 */
export function mapToCreateDocument(
  employee: EmployeeModel.toCreate,
): Omit<EmployeeDocument, 'sessionVersion'> {
  const { id, nif, ...rest } = employee;

  return {
    ...rest,
    _id: new mongoose.Types.ObjectId(id),
    nif: nif ? Number(nif) : null,
    username: employee.username ?? null,
    gender: employee.gender ?? null,
    address: employee.address ?? null,
    languages: employee.languages ?? null,
    emergencyContact: employee.emergencyContact ?? null,
    employmentId: employee.employmentId ?? null,
    jobTitle: employee.jobTitle ?? null,
  };
}
