import mongoose from 'mongoose';

/** Converts valid hex ids. Malformed values are skipped (a miss, not a throw). */
export function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  const objectIds: mongoose.Types.ObjectId[] = [];
  for (const id of ids) {
    try {
      objectIds.push(new mongoose.Types.ObjectId(id));
    } catch {
      // skip malformed ids — a miss answers as "no name"
    }
  }
  return objectIds;
}
