import { Entity } from '@shared/domain/entity/entity';
import { UniqueEntityId } from '@shared/domain/value-object/id/unique-entity-id.vo';
import { Name } from '@shared/domain/value-object';
import type { IndicationOriginInterval } from '../models/indication-origin.model';

type OriginCategoryId = 'canal' | 'campanha';

interface IndicationOriginProps {
  categoryId: OriginCategoryId;
  name: Name;
  nameKey: string;
  position: number;
  createdAt: Date;
  intervals: IndicationOriginInterval[];
}

export interface CreateIndicationOriginProps {
  categoryId: OriginCategoryId;
  name: string;
  position: number;
}

export interface ReconstituteIndicationOriginProps {
  id: string;
  categoryId: OriginCategoryId;
  name: Name;
  nameKey: string;
  position: number;
  createdAt: Date;
  intervals: IndicationOriginInterval[];
}

export class IndicationOrigin extends Entity<IndicationOriginProps> {
  private constructor(props: IndicationOriginProps, id?: UniqueEntityId) {
    super(props, id);
  }

  static nameKeyFrom(name: string): string {
    return IndicationOrigin.nameKeyFromName(Name.create(name));
  }

  static create(input: CreateIndicationOriginProps): IndicationOrigin {
    const createdAt = new Date();
    const inputName = Name.create(input.name);

    return new IndicationOrigin({
      categoryId: input.categoryId,
      name: inputName,
      nameKey: IndicationOrigin.nameKeyFromName(inputName),
      position: input.position,
      createdAt,
      intervals: [{ from: createdAt, to: null }],
    });
  }

  static reconstitute(
    input: ReconstituteIndicationOriginProps,
  ): IndicationOrigin {
    if (input.intervals.length === 0) {
      throw new Error('Indication origin must have at least one interval');
    }

    IndicationOrigin.assertStorableCategory(input.categoryId);

    return new IndicationOrigin(
      {
        categoryId: input.categoryId,
        name: input.name,
        nameKey: input.nameKey,
        position: input.position,
        createdAt: input.createdAt,
        intervals: input.intervals.map((interval) => ({
          from: interval.from,
          to: interval.to,
        })),
      },
      new UniqueEntityId(input.id),
    );
  }

  correctName(name: string): boolean {
    const nextName = Name.create(name);
    const nameKey = IndicationOrigin.nameKeyFromName(nextName);
    if (nameKey === this.props.nameKey) {
      return false;
    }

    this.props.name = nextName;
    this.props.nameKey = nameKey;
    return true;
  }

  end(): boolean {
    const last = this.props.intervals.at(-1);
    if (last === undefined || last.to !== null) {
      return false;
    }

    last.to = new Date();
    return true;
  }

  reopen(): boolean {
    const last = this.props.intervals.at(-1);
    if (last === undefined || last.to === null) {
      return false;
    }

    this.props.intervals.push({ from: new Date(), to: null });
    return true;
  }

  get categoryId(): OriginCategoryId {
    return this.props.categoryId;
  }

  get name(): Name {
    return this.props.name;
  }

  get nameKey(): string {
    return this.props.nameKey;
  }

  get position(): number {
    return this.props.position;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get intervals(): IndicationOriginInterval[] {
    return this.props.intervals.map((interval) => ({
      from: interval.from,
      to: interval.to,
    }));
  }

  get active(): boolean {
    return this.props.intervals.at(-1)?.to === null;
  }

  private static nameKeyFromName(name: Name): string {
    return name.value.toLowerCase();
  }

  private static assertStorableCategory(
    categoryId: string,
  ): asserts categoryId is OriginCategoryId {
    if (categoryId !== 'canal' && categoryId !== 'campanha') {
      throw new Error(
        `Indication origin category is not storable: "${categoryId}"`,
      );
    }
  }
}
