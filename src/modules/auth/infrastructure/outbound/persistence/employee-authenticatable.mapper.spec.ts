import mongoose from 'mongoose';
import { EmployeeDocument } from '@modules/employees/infrastructure/outbound/persistence/employee.schema';
import { mapEmployeeDocumentToAuthenticatable } from './employee-authenticatable.mapper';

const makeDocument = (
  overrides: Partial<EmployeeDocument> = {},
): EmployeeDocument =>
  ({
    _id: new mongoose.Types.ObjectId(),
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'EMPLOYEE',
    password: 'hashed_password',
    nif: 123456789,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    deactivateAt: null,
    ...overrides,
  }) as EmployeeDocument;

describe('mapEmployeeDocumentToAuthenticatable', () => {
  it.each(['ACTIVE', 'VACATION'] as const)(
    'should set loginCapable true when status is %s',
    (status) => {
      const result = mapEmployeeDocumentToAuthenticatable(
        makeDocument({ status }),
      );

      expect(result.loginCapable).toBe(true);
    },
  );

  it.each(['INACTIVE', 'REMOVED'] as const)(
    'should set loginCapable false when status is %s',
    (status) => {
      const result = mapEmployeeDocumentToAuthenticatable(
        makeDocument({ status }),
      );

      expect(result.loginCapable).toBe(false);
    },
  );

  it('should default sessionVersion to 0 when field is missing', () => {
    const result = mapEmployeeDocumentToAuthenticatable(makeDocument());

    expect(result.sessionVersion).toBe(0);
  });

  it('should map sessionVersion from the document', () => {
    const result = mapEmployeeDocumentToAuthenticatable(
      makeDocument({ sessionVersion: 3 }),
    );

    expect(result.sessionVersion).toBe(3);
  });
});
