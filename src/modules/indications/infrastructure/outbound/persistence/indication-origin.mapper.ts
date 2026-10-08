import { IndicationOriginCatalogRow } from '@modules/indications/application/ports/outbound/list-indication-origins.port';
import { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';
import mongoose from 'mongoose';
import { IndicationOriginDocument } from './indication-origin.schema';

export function toIndicationOriginDocument(snapshot: IndicationOriginSnapshot) {
  return {
    _id: new mongoose.Types.ObjectId(snapshot.id),
    categoryId: snapshot.categoryId,
    name: snapshot.name,
    nameKey: snapshot.nameKey,
    position: snapshot.position,
    createdAt: snapshot.createdAt,
    intervals: snapshot.intervals,
  };
}

export function mapIndicationOriginSnapshot(
  doc: IndicationOriginDocument,
): IndicationOriginSnapshot {
  return {
    id: String(doc._id),
    categoryId: doc.categoryId,
    name: doc.name,
    nameKey: doc.nameKey,
    position: doc.position,
    createdAt: doc.createdAt,
    intervals: doc.intervals.map((interval) => ({
      from: interval.from,
      to: interval.to ?? null,
    })),
  };
}

export function mapIndicationOriginCatalogRow(
  doc: IndicationOriginDocument,
): IndicationOriginCatalogRow {
  const last = doc.intervals.at(-1);
  const active = last !== undefined && last.to === null;

  return {
    id: String(doc._id),
    categoryId: doc.categoryId,
    name: doc.name,
    position: doc.position,
    active,
  };
}
