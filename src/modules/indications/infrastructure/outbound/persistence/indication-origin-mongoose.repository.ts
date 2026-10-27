import { FindIndicationOriginByIdPort } from '@modules/indications/application/ports/outbound/find-indication-origin-by-id.port';
import {
  FindIndicationOriginNamesByIdsPort,
  IndicationOriginNameReadModel,
} from '@modules/indications/application/ports/outbound/find-indication-origin-names-by-ids.port';
import { InsertIndicationOriginRepositoryPort } from '@modules/indications/application/ports/outbound/insert-indication-origin-repository.port';
import { ListIndicationOriginsPort } from '@modules/indications/application/ports/outbound/list-indication-origins.port';
import { NextIndicationOriginPositionPort } from '@modules/indications/application/ports/outbound/next-indication-origin-position.port';
import {
  UpdateIndicationOriginIntervalsParams,
  UpdateIndicationOriginIntervalsRepositoryPort,
} from '@modules/indications/application/ports/outbound/update-indication-origin-intervals-repository.port';
import {
  UpdateIndicationOriginNameParams,
  UpdateIndicationOriginNameRepositoryPort,
} from '@modules/indications/application/ports/outbound/update-indication-origin-name-repository.port';
import { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';
import { IndicationOriginNameTakenError } from '@modules/indications/domain/errors/indication.errors';
import {
  IndicationOriginNameAvailabilityPort,
  IndicationOriginNameAvailabilityQuery,
} from '@modules/indications/domain/ports/indication-origin-name-availability.port';
import { toObjectIds } from '@shared/infrastructure/adapters/mongoose/to-object-ids';
import {
  IndicationOriginDocument,
  IndicationOriginMongooseModel,
} from './indication-origin.schema';
import {
  mapIndicationOriginCatalogRow,
  mapIndicationOriginSnapshot,
  toIndicationOriginDocument,
} from './indication-origin.mapper';

export class IndicationOriginMongooseRepository
  implements
    InsertIndicationOriginRepositoryPort,
    UpdateIndicationOriginNameRepositoryPort,
    UpdateIndicationOriginIntervalsRepositoryPort,
    NextIndicationOriginPositionPort,
    FindIndicationOriginByIdPort,
    FindIndicationOriginNamesByIdsPort,
    ListIndicationOriginsPort,
    IndicationOriginNameAvailabilityPort
{
  constructor(
    private readonly indicationOriginModel: IndicationOriginMongooseModel,
  ) {}

  async insert(snapshot: IndicationOriginSnapshot): Promise<{ id: string }> {
    try {
      const doc = toIndicationOriginDocument(snapshot);
      await this.indicationOriginModel.create(doc);
    } catch (err) {
      if (this.isDuplicateKey(err)) {
        throw new IndicationOriginNameTakenError();
      }
      throw err;
    }

    return { id: snapshot.id };
  }

  async updateName(params: UpdateIndicationOriginNameParams): Promise<void> {
    const { id, name, nameKey } = params;

    try {
      const result = await this.indicationOriginModel.updateOne(
        { _id: id },
        { $set: { name, nameKey } },
      );

      if (result.matchedCount === 0) {
        throw new Error('Indication origin name update matched 0 documents');
      }
    } catch (err) {
      if (this.isDuplicateKey(err)) {
        throw new IndicationOriginNameTakenError();
      }
      throw err;
    }
  }

  async updateIntervals(
    params: UpdateIndicationOriginIntervalsParams,
  ): Promise<void> {
    const { id, intervals } = params;

    const result = await this.indicationOriginModel.updateOne(
      { _id: id },
      { $set: { intervals } },
    );

    if (result.matchedCount === 0) {
      throw new Error('Indication origin intervals update matched 0 documents');
    }
  }

  async existsByNameKey(
    input: IndicationOriginNameAvailabilityQuery,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = {
      categoryId: input.categoryId,
      nameKey: input.nameKey,
    };

    if (input.exceptOriginId !== undefined) {
      filter._id = { $ne: input.exceptOriginId };
    }

    const result = await this.indicationOriginModel.findOne(filter).lean();
    return Boolean(result);
  }

  async nextPosition(categoryId: 'canal' | 'campanha'): Promise<number> {
    const doc = await this.indicationOriginModel
      .findOne({ categoryId })
      .sort({ position: -1 })
      .select('position')
      .lean();

    return (doc?.position ?? 0) + 1;
  }

  async findById(id: string): Promise<IndicationOriginSnapshot | null> {
    try {
      const doc = await this.indicationOriginModel.findById(id).lean();
      if (!doc) return null;

      return mapIndicationOriginSnapshot(doc as IndicationOriginDocument);
    } catch {
      return null;
    }
  }

  async list() {
    const docs = await this.indicationOriginModel.find({}).lean();
    return docs.map((doc) =>
      mapIndicationOriginCatalogRow(doc as IndicationOriginDocument),
    );
  }

  async findOriginNamesByIds(
    ids: string[],
  ): Promise<IndicationOriginNameReadModel[]> {
    const objectIds = toObjectIds(ids);
    if (objectIds.length === 0) {
      return [];
    }

    const docs = await this.indicationOriginModel
      .find({ _id: { $in: objectIds } })
      .select('_id name')
      .lean();

    return (docs as Pick<IndicationOriginDocument, '_id' | 'name'>[]).map(
      (doc) => ({
        id: String(doc._id),
        name: doc.name,
      }),
    );
  }

  private isDuplicateKey(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    );
  }
}
