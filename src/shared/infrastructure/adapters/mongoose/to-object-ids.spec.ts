import mongoose from 'mongoose';
import { toObjectIds } from './to-object-ids';

const VALID_ID = '507f1f77bcf86cd799439011';
const OTHER_VALID_ID = '507f1f77bcf86cd799439012';

describe('toObjectIds', () => {
  it('should convert valid hex ids', () => {
    const result = toObjectIds([VALID_ID, OTHER_VALID_ID]);

    expect(result).toEqual([
      new mongoose.Types.ObjectId(VALID_ID),
      new mongoose.Types.ObjectId(OTHER_VALID_ID),
    ]);
  });

  it('should skip malformed ids', () => {
    expect(toObjectIds(['not-an-id', '', VALID_ID])).toEqual([
      new mongoose.Types.ObjectId(VALID_ID),
    ]);
  });

  it('should return an empty list when every id is malformed', () => {
    expect(toObjectIds(['not-an-id'])).toEqual([]);
  });

  it('should return an empty list when the input is empty', () => {
    expect(toObjectIds([])).toEqual([]);
  });
});
