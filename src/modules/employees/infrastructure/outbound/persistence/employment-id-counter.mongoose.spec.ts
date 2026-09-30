import { setupMongoMemoryServer } from '@configs/database/mongoose/test-setup-mongoose-menory';
import mongoose from 'mongoose';
import { EmploymentIdCounter } from './employment-id-counter.mongoose';
import {
  EmploymentIdCounterModel,
  EmploymentIdCounterSchema,
} from './employment-id-counter.schema';
import { EmployeeMongooseModel, EmployeeSchema } from './employee.schema';

describe('EmploymentIdCounter', () => {
  jest.setTimeout(60_000);

  setupMongoMemoryServer();

  let employeeModel: EmployeeMongooseModel;
  let counterModel: EmploymentIdCounterModel;
  let sut: EmploymentIdCounter;

  beforeAll(() => {
    employeeModel = mongoose.connection.model('Employee', EmployeeSchema);
    counterModel = mongoose.connection.model(
      'EmploymentIdCounter',
      EmploymentIdCounterSchema,
    );
    sut = new EmploymentIdCounter(employeeModel, counterModel);
  });

  const insertEmployee = (input: {
    email: string;
    employmentId: string | null;
    status?: 'ACTIVE' | 'REMOVED';
  }) =>
    employeeModel.create({
      name: 'Ada Lovelace',
      email: input.email,
      role: 'EMPLOYEE',
      password: 'hashed-password',
      employmentId: input.employmentId,
      status: input.status ?? 'ACTIVE',
    });

  const employmentSnapshot = async () => {
    const docs = await employeeModel
      .find()
      .select('email employmentId status')
      .lean();

    return docs
      .map((doc) => ({
        email: doc.email,
        employmentId: doc.employmentId,
        status: doc.status,
      }))
      .sort((left, right) => left.email.localeCompare(right.email));
  };

  it('issues "1" then "2" when there is no history and no counter', async () => {
    await expect(sut.allocate()).resolves.toBe('1');
    await expect(sut.allocate()).resolves.toBe('2');
  });

  it('seeds from the numeric max, skips non-digits, and leaves employees unchanged', async () => {
    await insertEmployee({ email: 'two@example.com', employmentId: '2' });
    await insertEmployee({ email: 'ten@example.com', employmentId: '10' });
    await insertEmployee({ email: 'empty@example.com', employmentId: null });
    await insertEmployee({
      email: 'legacy@example.com',
      employmentId: 'HR-001',
    });
    await insertEmployee({
      email: 'removed@example.com',
      employmentId: '7',
      status: 'REMOVED',
    });

    const before = await employmentSnapshot();

    await expect(sut.allocate()).resolves.toBe('11');

    await expect(employmentSnapshot()).resolves.toEqual(before);
  });

  it('does not reseed an existing counter from employee data', async () => {
    await counterModel.create({ _id: 'employee', seq: 4 });
    await insertEmployee({ email: 'nine@example.com', employmentId: '9' });

    await expect(sut.allocate()).resolves.toBe('5');
  });

  it('returns different strings for overlapping allocations on an empty history', async () => {
    const issued = await Promise.all([sut.allocate(), sut.allocate()]);

    expect(new Set(issued)).toEqual(new Set(['1', '2']));
  });

  it('treats "009" as 9 and issues the next id without padding', async () => {
    await insertEmployee({ email: 'padded@example.com', employmentId: '009' });

    await expect(sut.allocate()).resolves.toBe('10');
  });
});
