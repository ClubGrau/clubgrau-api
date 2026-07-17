import bcrypt from 'bcrypt';
import { BcryptAdapter } from './bcrypt.adapter';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_value'),
  compare: jest.fn().mockResolvedValue(true),
}));

const makeSut = (): BcryptAdapter => new BcryptAdapter();

describe('BcryptAdapter', () => {
  it('should be defined', () => {
    const sut = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(BcryptAdapter);
  });

  it('should have a hash method', () => {
    const sut = makeSut();
    expect(sut.encrypt.bind(sut)).toBeDefined();
    expect(typeof sut.encrypt).toBe('function');
  });

  it('Should call bcript with correct values', async () => {
    const sut = makeSut();
    const hashSpy = jest.spyOn(bcrypt, 'hash');
    const salt = 10;
    await sut.encrypt('any_value');
    expect(hashSpy).toHaveBeenCalledWith('any_value', salt);
  });

  it('Should return a hash on success', async () => {
    const sut = makeSut();
    const hash = await sut.encrypt('any_value');
    expect(hash).toBe('hashed_value');
  });

  it('Should throw if bcrypt throws', async () => {
    const sut = makeSut();
    jest
      .spyOn(bcrypt, 'hash')
      .mockImplementationOnce(() => Promise.reject(new Error()));
    const promise = sut.encrypt('any_value');
    await expect(promise).rejects.toThrow();
  });
});
