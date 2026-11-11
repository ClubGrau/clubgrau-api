import {
  Email,
  InvalidEmailError,
  InvalidNameError,
  InvalidNifError,
  InvalidPhoneFormatError,
  Name,
  Nif,
  Phone,
} from '@shared/domain/value-object';
import {
  CustomerAlreadyRemovedError,
  CustomerIndicationInvalidError,
} from '../errors/customer.errors';
import { Indication } from '../value-objects/indication.vo';
import { Customer } from './Customer';
import type { ReconstituteCustomerProps } from './Customer';

const HEX_24 = /^[0-9a-f]{24}$/;

const makeValidProps = () => ({
  name: 'John Doe',
  email: 'john@example.com',
});

const ORIGIN_ID = '507f1f77bcf86cd799439011';

const makeSnapshot = (
  overrides: Partial<ReconstituteCustomerProps> = {},
): ReconstituteCustomerProps => ({
  id: ORIGIN_ID,
  name: Name.create('Jane Doe'),
  email: Email.create('jane@example.com'),
  phone: null,
  nif: null,
  createdAt: new Date(),
  rank: 'BRONZE',
  indication: null,
  ...overrides,
});

describe('Customer (entity)', () => {
  describe('create', () => {
    it('should create a valid customer with sensible defaults', () => {
      const customer = Customer.create(makeValidProps());
      const json = customer.toJSON();

      expect(customer.id).toMatch(HEX_24);
      expect(json.id).toBe(customer.id);
      expect(json.name).toBe('John Doe');
      expect(json.email).toBe('john@example.com');
      expect(json.phone).toBeNull();
      expect(json.nif).toBeNull();
      expect(json.rank).toBe('BRONZE');
      expect(json.indication).toBeNull();
      expect(json.createdAt).toBeInstanceOf(Date);
      expect(customer.removedAt).toBeNull();
      expect(customer.isRemoved).toBe(false);
      expect(json.removedAt).toBeNull();
    });

    it('should create with a valid origin indication and remain Bronze', () => {
      const customer = Customer.create({
        ...makeValidProps(),
        indication: {
          categoryId: 'canal',
          originId: ORIGIN_ID,
          referrerCustomerId: null,
        },
      });

      expect(customer.toJSON().rank).toBe('BRONZE');
      expect(customer.toJSON().indication).toEqual({
        categoryId: 'canal',
        originId: ORIGIN_ID,
      });
    });

    it('should throw for an invalid indication and not return a customer', () => {
      expect(() =>
        Customer.create({
          ...makeValidProps(),
          indication: { categoryId: 'canal' },
        }),
      ).toThrow(CustomerIndicationInvalidError);
    });

    it('should not accept rank on create input', () => {
      const customer = Customer.create(makeValidProps());
      expect(customer.rank).toBe('BRONZE');
    });

    it('should return a fully plain object from toJSON()', () => {
      const customer = Customer.create(makeValidProps());
      const json = customer.toJSON();

      expect(typeof json.name).toBe('string');
      expect(typeof json.email).toBe('string');
    });

    it('should generate unique ids when none is provided', () => {
      const a = Customer.create(makeValidProps());
      const b = Customer.create(makeValidProps());
      expect(a.id).not.toBe(b.id);
    });

    it('should accept an optional phone', () => {
      const customer = Customer.create({
        ...makeValidProps(),
        phone: '+351 912 345 678',
      });
      expect(customer.toJSON().phone).toBe('351912345678');
    });

    it('should accept an optional NIF', () => {
      const customer = Customer.create({
        ...makeValidProps(),
        nif: 123456789,
      });
      expect(customer.toJSON().nif).toBe('123456789');
    });

    it('should treat omitted phone and nif as null', () => {
      const customer = Customer.create(makeValidProps());
      expect(customer.toJSON().phone).toBeNull();
      expect(customer.toJSON().nif).toBeNull();
    });

    it('should throw for an invalid name', () => {
      expect(() => Customer.create({ ...makeValidProps(), name: 'A' })).toThrow(
        InvalidNameError,
      );
    });

    it('should throw for an invalid email', () => {
      expect(() =>
        Customer.create({ ...makeValidProps(), email: 'not-an-email' }),
      ).toThrow(InvalidEmailError);
    });

    it('should throw for an invalid phone', () => {
      expect(() =>
        Customer.create({ ...makeValidProps(), phone: '123' }),
      ).toThrow(InvalidPhoneFormatError);
    });

    it('should throw for an invalid nif', () => {
      expect(() =>
        Customer.create({ ...makeValidProps(), nif: 111111111 }),
      ).toThrow(InvalidNifError);
    });
  });

  describe('reconstitute', () => {
    it('should rebuild a customer from a full snapshot', () => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');

      const customer = Customer.reconstitute(
        makeSnapshot({
          phone: Phone.create('+351 912 345 678'),
          nif: Nif.create('123456789'),
          createdAt,
        }),
      );

      const json = customer.toJSON();
      expect(customer.id).toBe('507f1f77bcf86cd799439011');
      expect(json.phone).toBe('351912345678');
      expect(json.nif).toBe('123456789');
      expect(json.createdAt).toBe(createdAt);
    });

    it('should round-trip rank and null indication', () => {
      const customer = Customer.reconstitute(
        makeSnapshot({ rank: 'SILVER', indication: null }),
      );

      expect(customer.toJSON().rank).toBe('SILVER');
      expect(customer.toJSON().indication).toBeNull();
    });

    it('should round-trip a reconstituted indication', () => {
      const indication = Indication.reconstitute({
        categoryId: 'amigo',
        referrerCustomerId: '507f1f77bcf86cd799439012',
      });

      const customer = Customer.reconstitute(
        makeSnapshot({ indication, rank: 'GOLD' }),
      );

      expect(customer.toJSON().indication).toEqual(indication.toJSON());
    });

    it('should default removedAt to null when omitted from snapshot', () => {
      const customer = Customer.reconstitute(makeSnapshot());
      expect(customer.removedAt).toBeNull();
      expect(customer.isRemoved).toBe(false);
    });

    it('should round-trip removedAt when present on snapshot', () => {
      const removedAt = new Date('2025-06-01T12:00:00.000Z');
      const customer = Customer.reconstitute(makeSnapshot({ removedAt }));
      expect(customer.removedAt).toBe(removedAt);
      expect(customer.isRemoved).toBe(true);
      expect(customer.toJSON().removedAt).toBe(removedAt);
    });
  });

  describe('remove', () => {
    it('should anonymize PII and set removedAt while keeping identity fields', () => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const indication = Indication.reconstitute({
        categoryId: 'amigo',
        referrerCustomerId: '507f1f77bcf86cd799439012',
      });
      const customer = Customer.reconstitute(
        makeSnapshot({
          id: '507f1f77bcf86cd799439011',
          phone: Phone.create('+351 912 345 678'),
          nif: Nif.create('123456789'),
          createdAt,
          indication,
        }),
      );
      const originalName = customer.toJSON().name;
      const originalId = customer.id;
      const now = new Date('2025-03-15T10:00:00.000Z');

      customer.remove(now);

      const json = customer.toJSON();
      expect(customer.id).toBe(originalId);
      expect(json.name).toBe(originalName);
      expect(json.email).toBe(`removed.${originalId}@anonymized.invalid`);
      expect(json.phone).toBeNull();
      expect(json.nif).toBeNull();
      expect(json.removedAt).toBe(now);
      expect(json.rank).toBe('BRONZE');
      expect(json.indication).toEqual(indication.toJSON());
      expect(json.createdAt).toBe(createdAt);
      expect(customer.isRemoved).toBe(true);
    });

    it('should throw on a second remove and keep the first removedAt', () => {
      const first = new Date('2025-01-01T00:00:00.000Z');
      const second = new Date('2025-02-01T00:00:00.000Z');
      const customer = Customer.create(makeValidProps());

      customer.remove(first);
      expect(() => customer.remove(second)).toThrow(
        CustomerAlreadyRemovedError,
      );
      expect(customer.removedAt).toBe(first);
    });

    it('should throw when reconstituted already removed', () => {
      const removedAt = new Date('2025-01-01T00:00:00.000Z');
      const customer = Customer.reconstitute(
        makeSnapshot({
          removedAt,
          email: Email.create(`removed.${ORIGIN_ID}@anonymized.invalid`),
        }),
      );

      expect(() =>
        customer.remove(new Date('2025-02-01T00:00:00.000Z')),
      ).toThrow(CustomerAlreadyRemovedError);
      expect(customer.removedAt).toBe(removedAt);
    });

    it('should use distinct email sentinels per customer id', () => {
      const now = new Date('2025-03-15T10:00:00.000Z');
      const a = Customer.create(makeValidProps());
      const b = Customer.create(makeValidProps());
      a.remove(now);
      b.remove(now);
      expect(a.toJSON().email).not.toBe(b.toJSON().email);
    });
  });

  describe('mutations', () => {
    it('should change name and email', () => {
      const customer = Customer.create(makeValidProps());

      customer.changeName(Name.create('New Name'));
      customer.changeEmail(Email.create('new@example.com'));

      expect(customer.toJSON().name).toBe('New Name');
      expect(customer.toJSON().email).toBe('new@example.com');
    });

    it('should assign and clear the phone', () => {
      const customer = Customer.create(makeValidProps());

      customer.assignPhone(Phone.create('+351 912 345 678'));
      expect(customer.toJSON().phone).toBe('351912345678');

      customer.assignPhone(null);
      expect(customer.toJSON().phone).toBeNull();
    });

    it('should assign and clear the NIF', () => {
      const customer = Customer.create(makeValidProps());

      customer.assignNif(Nif.create('123456789'));
      expect(customer.toJSON().nif).toBe('123456789');

      customer.assignNif(null);
      expect(customer.toJSON().nif).toBeNull();
    });
  });

  describe('identity', () => {
    it('should consider two customers with the same id equal', () => {
      const a = Customer.reconstitute(makeSnapshot());
      const b = Customer.reconstitute(makeSnapshot());
      expect(a.equals(b)).toBe(true);
    });

    it('should consider customers with different ids not equal', () => {
      const a = Customer.create(makeValidProps());
      const b = Customer.create(makeValidProps());
      expect(a.equals(b)).toBe(false);
    });
  });
});
