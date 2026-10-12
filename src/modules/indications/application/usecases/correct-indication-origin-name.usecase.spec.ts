import { IndicationOrigin } from '@modules/indications/domain/entities/IndicationOrigin';
import {
  IndicationOriginNameTakenError,
  IndicationOriginNotFoundError,
} from '@modules/indications/domain/errors/indication.errors';
import type { IndicationOriginSnapshot } from '@modules/indications/domain/models/indication-origin.model';
import type { IndicationOriginNameAvailabilityPort } from '@modules/indications/domain/ports/indication-origin-name-availability.port';
import { IndicationOriginNamePolicy } from '@modules/indications/domain/services/indication-origin-name.policy';
import { InvalidNameError } from '@shared/domain/value-object';
import { FindIndicationOriginByIdPort } from '../ports/outbound/find-indication-origin-by-id.port';
import { UpdateIndicationOriginNameRepositoryPort } from '../ports/outbound/update-indication-origin-name-repository.port';
import { CorrectIndicationOriginNameUsecase } from './correct-indication-origin-name.usecase';

const ORIGIN_ID = '507f1f77bcf86cd799439011';

const openCanalSnapshot = (): IndicationOriginSnapshot => ({
  id: ORIGIN_ID,
  categoryId: 'canal',
  name: 'Instagram',
  nameKey: 'instagram',
  position: 1,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  intervals: [{ from: new Date('2025-01-01T00:00:00.000Z'), to: null }],
});

const endedCanalSnapshot = (): IndicationOriginSnapshot => ({
  ...openCanalSnapshot(),
  intervals: [
    {
      from: new Date('2025-01-01T00:00:00.000Z'),
      to: new Date('2025-06-01T00:00:00.000Z'),
    },
  ],
});

const makeStubs = (
  snapshot: IndicationOriginSnapshot = openCanalSnapshot(),
) => {
  const availabilityStub = {
    existsByNameKey: jest.fn().mockResolvedValue(false),
  } satisfies IndicationOriginNameAvailabilityPort;

  const namePolicy = new IndicationOriginNamePolicy(availabilityStub);

  const findByIdStub = {
    findById: jest.fn().mockResolvedValue(snapshot),
  } satisfies FindIndicationOriginByIdPort;

  const updateNameStub = {
    updateName: jest.fn().mockResolvedValue(undefined),
  } satisfies UpdateIndicationOriginNameRepositoryPort;

  return { namePolicy, availabilityStub, findByIdStub, updateNameStub };
};

type SutTypes = ReturnType<typeof makeStubs> & {
  sut: CorrectIndicationOriginNameUsecase;
};

const makeSut = (snapshot?: IndicationOriginSnapshot): SutTypes => {
  const stubs = makeStubs(snapshot);
  const sut = new CorrectIndicationOriginNameUsecase(
    stubs.namePolicy,
    stubs.findByIdStub,
    stubs.updateNameStub,
  );
  return { ...stubs, sut };
};

describe('CorrectIndicationOriginNameUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeInstanceOf(CorrectIndicationOriginNameUsecase);
  });

  it('throws when findById misses and does not update', async () => {
    const { sut, findByIdStub, updateNameStub } = makeSut();
    findByIdStub.findById.mockResolvedValue(null);

    await expect(
      sut.execute({ id: ORIGIN_ID, name: 'TikTok' }),
    ).rejects.toBeInstanceOf(IndicationOriginNotFoundError);
    expect(updateNameStub.updateName).not.toHaveBeenCalled();
  });

  it('calls findById with the request id', async () => {
    const { sut, findByIdStub } = makeSut();

    await sut.execute({ id: ORIGIN_ID, name: 'instagram' });

    expect(findByIdStub.findById).toHaveBeenCalledWith(ORIGIN_ID);
  });

  it('returns id without policy or write when only case or spacing differs', async () => {
    const { sut, availabilityStub, updateNameStub } = makeSut();

    await expect(
      sut.execute({ id: ORIGIN_ID, name: 'instagram' }),
    ).resolves.toEqual({ id: ORIGIN_ID });
    await expect(
      sut.execute({ id: ORIGIN_ID, name: '  Instagram  ' }),
    ).resolves.toEqual({ id: ORIGIN_ID });

    expect(availabilityStub.existsByNameKey).not.toHaveBeenCalled();
    expect(updateNameStub.updateName).not.toHaveBeenCalled();
  });

  it('writes only id, name, and nameKey when the new name is free', async () => {
    const { sut, availabilityStub, updateNameStub } = makeSut();

    await sut.execute({ id: ORIGIN_ID, name: 'TikTok' });

    expect(availabilityStub.existsByNameKey).toHaveBeenCalledWith({
      categoryId: 'canal',
      nameKey: 'tiktok',
      exceptOriginId: ORIGIN_ID,
    });
    expect(updateNameStub.updateName).toHaveBeenCalledWith({
      id: ORIGIN_ID,
      name: 'TikTok',
      nameKey: 'tiktok',
    });
    expect(
      Object.keys(updateNameStub.updateName.mock.calls[0]?.[0] ?? {}),
    ).toEqual(['id', 'name', 'nameKey']);
  });

  it('does not write when the new name is taken', async () => {
    const { sut, availabilityStub, updateNameStub } = makeSut();
    availabilityStub.existsByNameKey.mockResolvedValue(true);

    await expect(
      sut.execute({ id: ORIGIN_ID, name: 'TikTok' }),
    ).rejects.toBeInstanceOf(IndicationOriginNameTakenError);
    expect(updateNameStub.updateName).not.toHaveBeenCalled();
  });

  it('corrects an ended origin without intervals in updateName', async () => {
    const { sut, updateNameStub } = makeSut(endedCanalSnapshot());

    await sut.execute({ id: ORIGIN_ID, name: 'TikTok' });

    expect(updateNameStub.updateName).toHaveBeenCalledWith({
      id: ORIGIN_ID,
      name: 'TikTok',
      nameKey: 'tiktok',
    });
    const payload = updateNameStub.updateName.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty('intervals');
  });

  it('rejects an invalid name without updateName', async () => {
    const { sut, updateNameStub } = makeSut();

    await expect(
      sut.execute({ id: ORIGIN_ID, name: 'a' }),
    ).rejects.toBeInstanceOf(InvalidNameError);
    expect(updateNameStub.updateName).not.toHaveBeenCalled();
  });

  it('propagates IndicationOriginNameTakenError from updateName', async () => {
    const { sut, updateNameStub } = makeSut();
    updateNameStub.updateName.mockRejectedValue(
      new IndicationOriginNameTakenError(),
    );

    await expect(
      sut.execute({ id: ORIGIN_ID, name: 'TikTok' }),
    ).rejects.toBeInstanceOf(IndicationOriginNameTakenError);
  });

  it('does not call IndicationOrigin.create on the reconstitute path', async () => {
    const createSpy = jest.spyOn(IndicationOrigin, 'create');
    const { sut } = makeSut();

    await sut.execute({ id: ORIGIN_ID, name: 'TikTok' });

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('depends on name policy, findById, and updateName only', () => {
    const { namePolicy, findByIdStub, updateNameStub } = makeStubs();
    const sut = new CorrectIndicationOriginNameUsecase(
      namePolicy,
      findByIdStub,
      updateNameStub,
    );
    expect(sut).toBeInstanceOf(CorrectIndicationOriginNameUsecase);
  });
});
