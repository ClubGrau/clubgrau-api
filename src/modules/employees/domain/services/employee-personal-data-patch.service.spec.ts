import { Email, Name, Nif, Password, Phone } from '@shared/domain/value-object';
import {
  InvalidNifError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { Employee, ReconstituteEmployeeProps } from '../entities/Employee';
import { InvalidEmployeeGenderError } from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { EmployeePersonalDataPatchService } from './employee-personal-data-patch.service';

const FIXED_ID = '507f1f77bcf86cd799439011';

const makeTarget = (
  overrides: Partial<ReconstituteEmployeeProps> = {},
): Employee =>
  Employee.reconstitute({
    id: FIXED_ID,
    name: Name.create('John Doe'),
    email: Email.create('john@example.com'),
    password: Password.fromHash('$2b$10$hashedvalue'),
    phone: null,
    nif: Nif.create('123456789'),
    role: EmployeeModel.Role.EMPLOYEE,
    status: EmployeeModel.Status.ACTIVE,
    createdAt: new Date(),
    deactivateAt: null,
    gender: 'female',
    languages: 'English',
    address: 'Old Street',
    emergencyContact: Phone.create('+351 912 000 001'),
    ...overrides,
  });

const makeSut = (): EmployeePersonalDataPatchService =>
  new EmployeePersonalDataPatchService();

describe('EmployeePersonalDataPatchService', () => {
  describe('gender', () => {
    it('should apply gender patch and return persist value', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { gender: 'male' });

      expect(patch).toEqual({ gender: 'male' });
      expect(target.toJSON().gender).toBe('male');
    });

    it('should clear gender when null', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { gender: null });

      expect(patch).toEqual({ gender: null });
      expect(target.toJSON().gender).toBeNull();
    });

    it.each(['invalid', ''])(
      'should throw InvalidEmployeeGenderError for %j without mutating gender',
      (gender) => {
        const sut = makeSut();
        const target = makeTarget();

        expect(() => sut.apply(target, { gender })).toThrow(
          InvalidEmployeeGenderError,
        );
        expect(target.toJSON().gender).toBe('female');
      },
    );
  });

  describe('languages', () => {
    it('should store languages as given', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { languages: 'Português' });

      expect(patch).toEqual({ languages: 'Português' });
      expect(target.toJSON().languages).toBe('Português');
    });

    it('should clear languages when null', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { languages: null });

      expect(patch).toEqual({ languages: null });
      expect(target.toJSON().languages).toBeNull();
    });
  });

  describe('address', () => {
    it('should store address as given without trimming', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { address: '  Rua X  ' });

      expect(patch).toEqual({ address: '  Rua X  ' });
      expect(target.toJSON().address).toBe('  Rua X  ');
    });

    it('should clear address when null', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { address: null });

      expect(patch).toEqual({ address: null });
      expect(target.toJSON().address).toBeNull();
    });
  });

  describe('emergencyContact', () => {
    it('should normalize phone in patch via VO value', () => {
      const sut = makeSut();
      const target = makeTarget();
      const raw = '+351 912 345 678';

      const patch = sut.apply(target, { emergencyContact: raw });

      expect(patch).toEqual({ emergencyContact: '351912345678' });
      expect(patch.emergencyContact).not.toBe(raw);
      expect(target.toJSON().emergencyContact).toBe('351912345678');
    });

    it('should clear emergency contact when null', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { emergencyContact: null });

      expect(patch).toEqual({ emergencyContact: null });
      expect(target.toJSON().emergencyContact).toBeNull();
    });

    it('should throw InvalidPhoneFormatError without assigning', () => {
      const sut = makeSut();
      const target = makeTarget();

      expect(() => sut.apply(target, { emergencyContact: '123' })).toThrow(
        InvalidPhoneFormatError,
      );
      expect(target.toJSON().emergencyContact).toBe('351912000001');
    });

    it('should clear emergency contact when empty string', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { emergencyContact: '' });

      expect(patch).toEqual({ emergencyContact: null });
      expect(target.toJSON().emergencyContact).toBeNull();
    });
  });

  describe('nif', () => {
    it('should apply nif patch with VO value string', () => {
      const sut = makeSut();
      const target = makeTarget({ nif: null });

      const patch = sut.apply(target, { nif: '123456789' });

      expect(patch).toEqual({ nif: '123456789' });
      expect(target.toJSON().nif).toBe('123456789');
    });

    it('should clear nif when null', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { nif: null });

      expect(patch).toEqual({ nif: null });
      expect(target.toJSON().nif).toBeNull();
    });

    it('should throw InvalidNifError without mutating nif', () => {
      const sut = makeSut();
      const target = makeTarget();

      expect(() => sut.apply(target, { nif: '00000000' })).toThrow(
        InvalidNifError,
      );
      expect(target.toJSON().nif).toBe('123456789');
    });

    it('should clear nif when empty string', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { nif: '' });

      expect(patch).toEqual({ nif: null });
      expect(target.toJSON().nif).toBeNull();
    });
  });

  describe('patch shape', () => {
    it('should return only the keys present in changes', () => {
      const sut = makeSut();
      const target = makeTarget();

      const patch = sut.apply(target, { languages: 'Français' });

      expect(patch).toEqual({ languages: 'Français' });
      expect(Object.keys(patch)).toEqual(['languages']);
      expect(target.toJSON().gender).toBe('female');
      expect(target.toJSON().address).toBe('Old Street');
    });

    it('should return empty patch and leave entity unchanged when changes is empty', () => {
      const sut = makeSut();
      const target = makeTarget();
      const before = target.toJSON();

      const patch = sut.apply(target, {});

      expect(patch).toEqual({});
      expect(target.toJSON()).toEqual(before);
    });
  });
});
