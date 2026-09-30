import { AllocateEmploymentIdPort } from '@modules/employees/application/ports/outbound/allocate-employment-id.port';
import { EmployeeMongooseModel } from './employee.schema';
import { EmploymentIdCounterModel } from './employment-id-counter.schema';

const COUNTER_ID = 'employee';

export class EmploymentIdCounter implements AllocateEmploymentIdPort {
  constructor(
    private readonly employeeModel: EmployeeMongooseModel,
    private readonly counterModel: EmploymentIdCounterModel,
  ) {}

  async allocate(): Promise<string> {
    await this.ensureSeeded();

    const updated = await this.counterModel.findOneAndUpdate(
      { _id: COUNTER_ID },
      { $inc: { seq: 1 } },
      { returnDocument: 'after' },
    );

    if (!updated) {
      throw new Error('Employment id counter missing after seed');
    }

    return String(updated.seq);
  }

  private async ensureSeeded(): Promise<void> {
    const existing = await this.counterModel.exists({ _id: COUNTER_ID });
    if (existing) {
      return;
    }

    const max = await this.maxNumericEmploymentId();
    await this.counterModel.updateOne(
      { _id: COUNTER_ID },
      { $setOnInsert: { seq: max } },
      { upsert: true },
    );
  }

  private async maxNumericEmploymentId(): Promise<number> {
    const [row] = await this.employeeModel.aggregate<{ max?: number | null }>([
      {
        $match: {
          employmentId: { $regex: /^[0-9]+$/ },
        },
      },
      {
        $group: {
          _id: null,
          max: { $max: { $toInt: '$employmentId' } },
        },
      },
    ]);

    return row?.max ?? 0;
  }
}
