import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { CustomerSnapshotMapper } from './customer-snapshot.mapper';

const CUSTOMER_ID = '507f1f77bcf86cd799439011';
const REFERRER_ID = '507f1f77bcf86cd799439012';

const makeSnapshot = (
  overrides: Partial<CustomerModel.toCreate> = {},
): CustomerModel.toCreate => ({
  id: CUSTOMER_ID,
  name: 'Maria Silva',
  email: 'maria.silva@example.com',
  phone: '351912345678',
  nif: '123456789',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  rank: 'BRONZE',
  indication: {
    categoryId: 'amigo',
    referrerCustomerId: REFERRER_ID,
  },
  removedAt: new Date('2025-06-01T12:00:00.000Z'),
  ...overrides,
});

describe('CustomerSnapshotMapper', () => {
  it('should round-trip a full snapshot including removedAt', () => {
    const snapshot = makeSnapshot();

    const entity = CustomerSnapshotMapper.toEntity(snapshot);

    expect(entity.toJSON()).toEqual(snapshot);
  });

  it('should set removedAt to null when absent on the snapshot', () => {
    const snapshot = makeSnapshot({ removedAt: undefined });

    const entity = CustomerSnapshotMapper.toEntity(snapshot);

    expect(entity.toJSON().removedAt).toBeNull();
  });
});
