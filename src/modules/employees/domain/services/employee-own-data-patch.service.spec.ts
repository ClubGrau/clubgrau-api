import {
  InvalidNameError,
  InvalidNifError,
  InvalidPhoneFormatError,
} from '@shared/domain/value-object';
import { Employee } from '../entities/Employee';
import { InvalidEmployeeGenderError } from '../errors/employee.errors';
import { EmployeeModel } from '../models/employee.model';
import { EmployeeOwnDataPatchService } from './employee-own-data-patch.service';
import { EmployeePersonalDataPatchService } from './employee-personal-data-patch.service';

const makeActor = (): Employee =>
  Employee.create({
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'P@ssword123',
    phone: '+351 910 000 001',
    role: EmployeeModel.Role.EMPLOYEE,
    username: 'old.user',
    gender: 'female',
    languages: 'English',
    address: 'Old Street',
    emergencyContact: '+351 912 000 001',
    nif: 123456789,
  });

const makeSut = (): EmployeeOwnDataPatchService =>
  new EmployeeOwnDataPatchService(new EmployeePersonalDataPatchService());

describe('EmployeeOwnDataPatchService', () => {
  describe('name', () => {
    it('should apply a valid name and return the normalized value', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { name: 'Ana Silva' });

      expect(patch).toEqual({ name: 'Ana Silva' });
      expect(actor.toJSON().name).toBe('Ana Silva');
    });

    it('should throw InvalidNameError when name is null', () => {
      const sut = makeSut();
      const actor = makeActor();

      expect(() => sut.apply(actor, { name: null })).toThrow(InvalidNameError);
      expect(actor.toJSON().name).toBe('John Doe');
    });

    it('should throw InvalidNameError when name is below the minimum length', () => {
      const sut = makeSut();
      const actor = makeActor();

      expect(() => sut.apply(actor, { name: 'A' })).toThrow(InvalidNameError);
    });
  });

  describe('phone', () => {
    it('should apply a valid phone and return the normalized value', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { phone: '+351 912 345 678' });

      expect(patch).toEqual({ phone: '351912345678' });
      expect(actor.toJSON().phone).toBe('351912345678');
    });

    it('should throw InvalidPhoneFormatError when phone is null', () => {
      const sut = makeSut();
      const actor = makeActor();

      expect(() => sut.apply(actor, { phone: null })).toThrow(
        InvalidPhoneFormatError,
      );
      expect(actor.toJSON().phone).toBe('351910000001');
    });

    it('should throw InvalidPhoneFormatError when phone is invalid', () => {
      const sut = makeSut();
      const actor = makeActor();

      expect(() => sut.apply(actor, { phone: '123' })).toThrow(
        InvalidPhoneFormatError,
      );
    });
  });

  describe('username', () => {
    it.each([null, '', '   '])(
      'should clear username when the value is %j',
      (username) => {
        const sut = makeSut();
        const actor = makeActor();

        const patch = sut.apply(actor, { username });

        expect(patch).toEqual({ username: null });
        expect(actor.toJSON().username).toBeNull();
      },
    );

    it('should trim a non-blank username', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { username: '  joao  ' });

      expect(patch).toEqual({ username: 'joao' });
      expect(actor.toJSON().username).toBe('joao');
    });
  });

  describe('personal fields', () => {
    it('should apply gender through the personal patch service', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { gender: 'male' });

      expect(patch).toEqual({ gender: 'male' });
      expect(actor.toJSON().gender).toBe('male');
    });

    it('should clear gender when null', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { gender: null });

      expect(patch).toEqual({ gender: null });
      expect(actor.toJSON().gender).toBeNull();
    });

    it.each(['invalid', ''])(
      'should throw InvalidEmployeeGenderError for gender %j',
      (gender) => {
        const sut = makeSut();
        const actor = makeActor();

        expect(() => sut.apply(actor, { gender })).toThrow(
          InvalidEmployeeGenderError,
        );
      },
    );

    it('should set languages', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { languages: 'Português' });

      expect(patch).toEqual({ languages: 'Português' });
      expect(actor.toJSON().languages).toBe('Português');
    });

    it('should clear languages when null', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { languages: null });

      expect(patch).toEqual({ languages: null });
      expect(actor.toJSON().languages).toBeNull();
    });

    it('should set address', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { address: 'Rua X' });

      expect(patch).toEqual({ address: 'Rua X' });
      expect(actor.toJSON().address).toBe('Rua X');
    });

    it('should clear address when null', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { address: null });

      expect(patch).toEqual({ address: null });
      expect(actor.toJSON().address).toBeNull();
    });

    it('should normalize emergency contact', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, {
        emergencyContact: '+351 912 345 678',
      });

      expect(patch).toEqual({ emergencyContact: '351912345678' });
      expect(actor.toJSON().emergencyContact).toBe('351912345678');
    });

    it('should clear emergency contact when null', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { emergencyContact: null });

      expect(patch).toEqual({ emergencyContact: null });
      expect(actor.toJSON().emergencyContact).toBeNull();
    });

    it('should throw InvalidPhoneFormatError when emergency contact is invalid', () => {
      const sut = makeSut();
      const actor = makeActor();

      expect(() => sut.apply(actor, { emergencyContact: '123' })).toThrow(
        InvalidPhoneFormatError,
      );
    });

    it('should apply nif as a string', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { nif: '123456789' });

      expect(patch).toEqual({ nif: '123456789' });
      expect(actor.toJSON().nif).toBe('123456789');
    });

    it('should clear nif when null', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { nif: null });

      expect(patch).toEqual({ nif: null });
      expect(actor.toJSON().nif).toBeNull();
    });

    it('should throw InvalidNifError when nif is invalid', () => {
      const sut = makeSut();
      const actor = makeActor();

      expect(() => sut.apply(actor, { nif: '00000000' })).toThrow(
        InvalidNifError,
      );
    });
  });

  describe('composition', () => {
    it('should throw InvalidNifError and return no patch when a valid name is paired with an invalid nif', () => {
      const sut = makeSut();
      const actor = makeActor();

      expect(() =>
        sut.apply(actor, { name: 'Ana Silva', nif: '00000000' }),
      ).toThrow(InvalidNifError);
    });

    it('should return only the present field', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { languages: 'Português' });

      expect(Object.keys(patch)).toEqual(['languages']);
    });

    it('should return only name and the personal field when both are present', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { name: 'Ana Silva', gender: 'male' });

      expect(patch).toEqual({ name: 'Ana Silva', gender: 'male' });
      expect(Object.keys(patch).sort()).toEqual(['gender', 'name']);
    });

    it('should return an empty patch and leave the entity unchanged', () => {
      const sut = makeSut();
      const actor = makeActor();
      const before = actor.toJSON();

      const patch = sut.apply(actor, {});

      expect(patch).toEqual({});
      expect(actor.toJSON()).toEqual(before);
    });

    it('should not include email on a name-only patch', () => {
      const sut = makeSut();
      const actor = makeActor();

      const patch = sut.apply(actor, { name: 'Ana Silva' });

      expect(patch).not.toHaveProperty('email');
      expect(Object.keys(patch)).toEqual(['name']);
    });
  });
});
