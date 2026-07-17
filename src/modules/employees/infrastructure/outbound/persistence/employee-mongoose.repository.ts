import { Model } from 'mongoose';
import { EmployeeDocument } from './employee.schema';

export class EmployeeMongooseRepository {
  constructor(private readonly employeeModel: Model<EmployeeDocument>) {
    void this.employeeModel;
  }
}
