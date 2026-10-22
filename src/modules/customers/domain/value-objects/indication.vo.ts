import { ValueObject } from '@shared/domain/value-object/value-object';
import { UniqueEntityId } from '@shared/domain/value-object/id/unique-entity-id.vo';
import type { IndicationOriginFacts } from '../models/indication-origin-facts';
import {
  CustomerIndicationInvalidError,
  CustomerIndicationOriginCategoryMismatchError,
  CustomerIndicationOriginEndedError,
  CustomerIndicationOriginNotFoundError,
  CustomerReferrerNotFoundError,
} from '../errors/customer.errors';

export type IndicationSnapshot =
  | { categoryId: 'canal' | 'campanha'; originId: string }
  | { categoryId: 'amigo'; referrerCustomerId: string };

type OriginIndicationProps = {
  categoryId: 'canal' | 'campanha';
  originId: UniqueEntityId;
};

type FriendIndicationProps = {
  categoryId: 'amigo';
  referrerCustomerId: UniqueEntityId;
};

type IndicationProps = OriginIndicationProps | FriendIndicationProps;

const VALID_CATEGORY_IDS = ['canal', 'campanha', 'amigo'] as const;
type ValidCategoryId = (typeof VALID_CATEGORY_IDS)[number];

function isAbsent(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isValidCategoryId(value: string): value is ValidCategoryId {
  return (VALID_CATEGORY_IDS as readonly string[]).includes(value);
}

export class Indication extends ValueObject<IndicationProps> {
  private constructor(props: IndicationProps) {
    super(props);
  }

  static create(input: {
    categoryId: string;
    originId?: string | null;
    referrerCustomerId?: string | null;
  }): Indication {
    if (
      typeof input.categoryId !== 'string' ||
      !isValidCategoryId(input.categoryId)
    ) {
      throw new CustomerIndicationInvalidError();
    }

    const categoryId = input.categoryId;

    if (categoryId === 'canal' || categoryId === 'campanha') {
      if (isAbsent(input.originId) || !isAbsent(input.referrerCustomerId)) {
        throw new CustomerIndicationInvalidError();
      }

      if (typeof input.originId !== 'string') {
        throw new CustomerIndicationInvalidError();
      }

      return new Indication({
        categoryId,
        originId: new UniqueEntityId(input.originId),
      });
    }

    if (isAbsent(input.referrerCustomerId) || !isAbsent(input.originId)) {
      throw new CustomerIndicationInvalidError();
    }

    if (typeof input.referrerCustomerId !== 'string') {
      throw new CustomerIndicationInvalidError();
    }

    return new Indication({
      categoryId: 'amigo',
      referrerCustomerId: new UniqueEntityId(input.referrerCustomerId),
    });
  }

  static reconstitute(snapshot: IndicationSnapshot): Indication {
    if (snapshot.categoryId === 'amigo') {
      return new Indication({
        categoryId: 'amigo',
        referrerCustomerId: new UniqueEntityId(snapshot.referrerCustomerId),
      });
    }

    return new Indication({
      categoryId: snapshot.categoryId,
      originId: new UniqueEntityId(snapshot.originId),
    });
  }

  get categoryId(): IndicationSnapshot['categoryId'] {
    return this.props.categoryId;
  }

  ensureOriginIsLinkable(facts: IndicationOriginFacts | null): void {
    if (this.props.categoryId === 'amigo') {
      throw new Error(
        'Indication.ensureOriginIsLinkable called on a friend indication',
      );
    }

    if (facts === null) {
      throw new CustomerIndicationOriginNotFoundError();
    }

    if (facts.categoryId !== this.props.categoryId) {
      throw new CustomerIndicationOriginCategoryMismatchError();
    }

    if (facts.active === false) {
      throw new CustomerIndicationOriginEndedError();
    }
  }

  ensureReferrerExists(exists: boolean): void {
    if (this.props.categoryId !== 'amigo') {
      throw new Error(
        'Indication.ensureReferrerExists called on an origin indication',
      );
    }

    if (exists === false) {
      throw new CustomerReferrerNotFoundError();
    }
  }

  toJSON(): IndicationSnapshot {
    if (this.props.categoryId === 'amigo') {
      return {
        categoryId: 'amigo',
        referrerCustomerId: this.props.referrerCustomerId.value,
      };
    }

    return {
      categoryId: this.props.categoryId,
      originId: this.props.originId.value,
    };
  }
}
