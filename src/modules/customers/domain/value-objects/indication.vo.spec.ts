import { InvalidUniqueEntityIdError } from '@shared/domain/value-object';
import {
  CustomerIndicationInvalidError,
  CustomerIndicationOriginCategoryMismatchError,
  CustomerIndicationOriginEndedError,
  CustomerIndicationOriginNotFoundError,
  CustomerReferrerNotFoundError,
} from '../errors/customer.errors';
import { Indication } from './indication.vo';

const ORIGIN_ID = '507f1f77bcf86cd799439011';
const REFERRER_ID = '507f1f77bcf86cd799439012';

describe('Indication', () => {
  describe('create', () => {
    it('builds canal with a 24-hex originId', () => {
      const indication = Indication.create({
        categoryId: 'canal',
        originId: ORIGIN_ID,
        referrerCustomerId: null,
      });

      expect(indication.toJSON()).toEqual({
        categoryId: 'canal',
        originId: ORIGIN_ID,
      });
      expect(indication.toJSON()).not.toHaveProperty('referrerCustomerId');
    });

    it('builds campanha with a 24-hex originId', () => {
      const indication = Indication.create({
        categoryId: 'campanha',
        originId: ORIGIN_ID,
        referrerCustomerId: null,
      });

      expect(indication.toJSON()).toEqual({
        categoryId: 'campanha',
        originId: ORIGIN_ID,
      });
      expect(indication.toJSON()).not.toHaveProperty('referrerCustomerId');
    });

    it('builds amigo with a referrerCustomerId', () => {
      const indication = Indication.create({
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
        originId: null,
      });

      expect(indication.toJSON()).toEqual({
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
      });
      expect(indication.toJSON()).not.toHaveProperty('originId');
    });

    it('builds canal when referrerCustomerId is omitted', () => {
      const indication = Indication.create({
        categoryId: 'canal',
        originId: ORIGIN_ID,
      });

      expect(indication.toJSON()).toEqual({
        categoryId: 'canal',
        originId: ORIGIN_ID,
      });
      expect(indication.toJSON()).not.toHaveProperty('referrerCustomerId');
    });

    it('builds amigo when originId is omitted', () => {
      const indication = Indication.create({
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
      });

      expect(indication.toJSON()).toEqual({
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
      });
      expect(indication.toJSON()).not.toHaveProperty('originId');
    });

    it.each(['unknown', '', 'CANAL'])(
      'rejects invalid categoryId %s',
      (categoryId) => {
        expect(() =>
          Indication.create({ categoryId, originId: ORIGIN_ID }),
        ).toThrow(CustomerIndicationInvalidError);
      },
    );

    it.each([
      { originId: undefined },
      { originId: null },
      { originId: ORIGIN_ID, referrerCustomerId: REFERRER_ID },
      { originId: ORIGIN_ID, referrerCustomerId: '' },
    ] as const)('rejects invalid canal shape %#', (input) => {
      expect(() =>
        Indication.create({ categoryId: 'canal', ...input }),
      ).toThrow(CustomerIndicationInvalidError);
    });

    it.each([
      { referrerCustomerId: undefined },
      { referrerCustomerId: null },
      { referrerCustomerId: REFERRER_ID, originId: ORIGIN_ID },
      { referrerCustomerId: REFERRER_ID, originId: '' },
    ] as const)('rejects invalid amigo shape %#', (input) => {
      expect(() =>
        Indication.create({ categoryId: 'amigo', ...input }),
      ).toThrow(CustomerIndicationInvalidError);
    });

    it('rejects empty originId with InvalidUniqueEntityIdError', () => {
      expect(() =>
        Indication.create({
          categoryId: 'canal',
          originId: '',
          referrerCustomerId: null,
        }),
      ).toThrow(InvalidUniqueEntityIdError);
    });

    it('rejects a non-string originId', () => {
      expect(() =>
        Indication.create({
          categoryId: 'canal',
          originId: 123 as unknown as string,
          referrerCustomerId: null,
        }),
      ).toThrow(CustomerIndicationInvalidError);
    });

    it('accepts uppercase hex and stores lowercase', () => {
      const upper = '507F1F77BCF86CD799439011';
      const indication = Indication.create({
        categoryId: 'canal',
        originId: upper,
        referrerCustomerId: null,
      });

      expect(indication.toJSON()).toEqual({
        categoryId: 'canal',
        originId: upper.toLowerCase(),
      });
    });
  });

  describe('reconstitute', () => {
    it('returns the stored origin snapshot without linkability checks', () => {
      const snapshot = {
        categoryId: 'canal' as const,
        originId: ORIGIN_ID,
      };
      const indication = Indication.reconstitute(snapshot);

      expect(indication.toJSON()).toEqual(snapshot);
      expect(() => indication.ensureOriginIsLinkable(null)).toThrow(
        CustomerIndicationOriginNotFoundError,
      );
    });
  });

  describe('ensureOriginIsLinkable', () => {
    const originIndication = Indication.create({
      categoryId: 'canal',
      originId: ORIGIN_ID,
      referrerCustomerId: null,
    });

    it('throws when facts are null', () => {
      expect(() => originIndication.ensureOriginIsLinkable(null)).toThrow(
        CustomerIndicationOriginNotFoundError,
      );
    });

    it('throws on category mismatch even when inactive', () => {
      expect(() =>
        originIndication.ensureOriginIsLinkable({
          id: ORIGIN_ID,
          categoryId: 'campanha',
          active: false,
        }),
      ).toThrow(CustomerIndicationOriginCategoryMismatchError);
    });

    it('throws when the origin is ended', () => {
      expect(() =>
        originIndication.ensureOriginIsLinkable({
          id: ORIGIN_ID,
          categoryId: 'canal',
          active: false,
        }),
      ).toThrow(CustomerIndicationOriginEndedError);
    });

    it('returns when facts match and are active', () => {
      expect(() =>
        originIndication.ensureOriginIsLinkable({
          id: 'ignored-id',
          categoryId: 'canal',
          active: true,
        }),
      ).not.toThrow();
    });

    it('throws a plain Error on a friend indication', () => {
      const friend = Indication.create({
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
        originId: null,
      });

      expect(() => friend.ensureOriginIsLinkable(null)).toThrow(Error);
      expect(() => friend.ensureOriginIsLinkable(null)).not.toThrow(
        CustomerIndicationOriginNotFoundError,
      );
    });
  });

  describe('ensureReferrerExists', () => {
    it('throws when the referrer does not exist', () => {
      const friend = Indication.create({
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
        originId: null,
      });

      expect(() => friend.ensureReferrerExists(false)).toThrow(
        CustomerReferrerNotFoundError,
      );
    });

    it('returns when the referrer exists', () => {
      const friend = Indication.create({
        categoryId: 'amigo',
        referrerCustomerId: REFERRER_ID,
        originId: null,
      });

      expect(() => friend.ensureReferrerExists(true)).not.toThrow();
    });

    it('throws a plain Error on an origin indication', () => {
      const origin = Indication.create({
        categoryId: 'canal',
        originId: ORIGIN_ID,
        referrerCustomerId: null,
      });

      expect(() => origin.ensureReferrerExists(true)).toThrow(Error);
      expect(() => origin.ensureReferrerExists(true)).not.toThrow(
        CustomerReferrerNotFoundError,
      );
    });
  });
});
