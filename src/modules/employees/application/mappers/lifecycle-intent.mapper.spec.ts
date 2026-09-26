import { EmployeeModel } from '@modules/employees/domain/models/employee.model';
import { LifecycleIntent } from '@modules/employees/domain/services/employee-lifecycle.policy';
import { LifecycleIntentMapper } from './lifecycle-intent.mapper';

describe('LifecycleIntentMapper', () => {
  it.each<[EmployeeModel.OperationalStatus, LifecycleIntent]>([
    [EmployeeModel.Status.ACTIVE, 'REACTIVATE'],
    [EmployeeModel.Status.INACTIVE, 'DEACTIVATE'],
    [EmployeeModel.Status.VACATION, 'VACATION'],
  ])('should map %s to %s', (status, intent) => {
    expect(LifecycleIntentMapper.toIntent(status)).toBe(intent);
  });
});
