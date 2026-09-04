import mongoose from 'mongoose';
import { makeChainableMock } from '@configs/database/mongoose/testables';
import { PasswordResetToken } from '@modules/auth/domain/models/password-reset-token.model';
import {
  PasswordResetTokenDocument,
  PasswordResetTokenMongooseModel,
} from './password-reset-token.schema';
import { PasswordResetTokenMongooseRepository } from './password-reset-token-mongoose.repository';

const mockDocument = {
  _id: new mongoose.Types.ObjectId(),
  ownerId: 'owner-1',
  tokenHash: 'hashed-token',
  issuedAt: new Date('2024-01-01T00:00:00Z'),
  expiresAt: new Date('2024-01-01T01:00:00Z'),
} as PasswordResetTokenDocument;

const makeToken = (): PasswordResetToken => ({
  ownerId: 'owner-1',
  tokenHash: 'hashed-token',
  issuedAt: new Date('2024-01-01T00:00:00Z'),
  expiresAt: new Date('2024-01-01T01:00:00Z'),
});

const makeSut = (returnValue?: unknown) => {
  const modelMock = {
    ...makeChainableMock(returnValue),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const sut = new PasswordResetTokenMongooseRepository(
    modelMock as unknown as PasswordResetTokenMongooseModel,
  );
  return { sut, modelMock };
};

describe('PasswordResetTokenMongooseRepository', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(PasswordResetTokenMongooseRepository);
  });

  describe('findByOwnerId', () => {
    it('should query findOne by ownerId and map the document (hit)', async () => {
      const { sut, modelMock } = makeSut(mockDocument);

      const result = await sut.findByOwnerId('owner-1');

      expect(modelMock.findOne).toHaveBeenCalledWith({ ownerId: 'owner-1' });
      expect(result).toEqual({
        ownerId: 'owner-1',
        tokenHash: 'hashed-token',
        issuedAt: mockDocument.issuedAt,
        expiresAt: mockDocument.expiresAt,
      });
    });

    it('should return null when no document is found (miss)', async () => {
      const { sut } = makeSut(null);

      const result = await sut.findByOwnerId('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByTokenHash', () => {
    it('should query findOne by tokenHash and map the document (hit)', async () => {
      const { sut, modelMock } = makeSut(mockDocument);

      const result = await sut.findByTokenHash('hashed-token');

      expect(modelMock.findOne).toHaveBeenCalledWith({
        tokenHash: 'hashed-token',
      });
      expect(result).toEqual({
        ownerId: 'owner-1',
        tokenHash: 'hashed-token',
        issuedAt: mockDocument.issuedAt,
        expiresAt: mockDocument.expiresAt,
      });
    });

    it('should return null when no document is found (miss)', async () => {
      const { sut } = makeSut(null);

      const result = await sut.findByTokenHash('missing');

      expect(result).toBeNull();
    });
  });

  describe('upsertByOwnerId', () => {
    it('should updateOne with last-wins upsert payload', async () => {
      const { sut, modelMock } = makeSut();
      const token = makeToken();

      await sut.upsertByOwnerId(token);

      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { ownerId: token.ownerId },
        {
          $set: {
            ownerId: token.ownerId,
            tokenHash: token.tokenHash,
            issuedAt: token.issuedAt,
            expiresAt: token.expiresAt,
          },
        },
        { upsert: true },
      );
    });
  });

  describe('deleteByOwnerId', () => {
    it('should deleteOne by ownerId', async () => {
      const { sut, modelMock } = makeSut();

      await sut.deleteByOwnerId('owner-1');

      expect(modelMock.deleteOne).toHaveBeenCalledWith({ ownerId: 'owner-1' });
    });

    it('should be a no-op resolution when the document is missing', async () => {
      const { sut, modelMock } = makeSut();
      modelMock.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });

      await expect(sut.deleteByOwnerId('missing')).resolves.toBeUndefined();
    });
  });
});
