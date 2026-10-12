import {
  IndicationCategoryDoesNotHoldOriginsError,
  IndicationCategoryUnknownError,
  IndicationOriginNameTakenError,
} from '@modules/indications/domain/errors/indication.errors';
import type { IndicationOriginNameAvailabilityPort } from '@modules/indications/domain/ports/indication-origin-name-availability.port';
import { IndicationOriginNamePolicy } from '@modules/indications/domain/services/indication-origin-name.policy';
import { InvalidNameError } from '@shared/domain/value-object';
import { CreateIndicationOriginDto } from '../dtos/create-indication-origin.dto';
import { InsertIndicationOriginRepositoryPort } from '../ports/outbound/insert-indication-origin-repository.port';
import { NextIndicationOriginPositionPort } from '../ports/outbound/next-indication-origin-position.port';
import { CreateIndicationOriginUsecase } from './create-indication-origin.usecase';

const HEX_24 = /^[0-9a-f]{24}$/;

const makeStubs = () => {
  const availabilityStub = {
    existsByNameKey: jest.fn().mockResolvedValue(false),
  } satisfies IndicationOriginNameAvailabilityPort;

  const namePolicy = new IndicationOriginNamePolicy(availabilityStub);

  const nextPositionStub = {
    nextPosition: jest.fn().mockResolvedValue(1),
  } satisfies NextIndicationOriginPositionPort;

  const insertStub = {
    insert: jest
      .fn()
      .mockImplementation(async (snapshot) => ({ id: snapshot.id })),
  } satisfies InsertIndicationOriginRepositoryPort;

  return { namePolicy, availabilityStub, nextPositionStub, insertStub };
};

type SutTypes = ReturnType<typeof makeStubs> & {
  sut: CreateIndicationOriginUsecase;
};

const makeSut = (): SutTypes => {
  const stubs = makeStubs();
  const sut = new CreateIndicationOriginUsecase(
    stubs.namePolicy,
    stubs.nextPositionStub,
    stubs.insertStub,
  );
  return { ...stubs, sut };
};

const makeValidParams = (
  overrides: Partial<CreateIndicationOriginDto> = {},
): CreateIndicationOriginDto => ({
  categoryId: 'canal',
  name: 'Instagram',
  ...overrides,
});

describe('CreateIndicationOriginUsecase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeInstanceOf(CreateIndicationOriginUsecase);
  });

  it('rejects an unknown categoryId before any write', async () => {
    const { sut, availabilityStub, nextPositionStub, insertStub } = makeSut();

    await expect(
      sut.execute(makeValidParams({ categoryId: 'unknown' })),
    ).rejects.toBeInstanceOf(IndicationCategoryUnknownError);

    expect(availabilityStub.existsByNameKey).not.toHaveBeenCalled();
    expect(nextPositionStub.nextPosition).not.toHaveBeenCalled();
    expect(insertStub.insert).not.toHaveBeenCalled();
  });

  it("rejects categoryId 'amigo' before any write", async () => {
    const { sut, availabilityStub, nextPositionStub, insertStub } = makeSut();

    await expect(
      sut.execute(makeValidParams({ categoryId: 'amigo' })),
    ).rejects.toBeInstanceOf(IndicationCategoryDoesNotHoldOriginsError);

    expect(availabilityStub.existsByNameKey).not.toHaveBeenCalled();
    expect(nextPositionStub.nextPosition).not.toHaveBeenCalled();
    expect(insertStub.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['whitespace only', ' '],
    ['too short', 'a'],
    ['too long after normalize', 'a'.repeat(101)],
  ])('rejects invalid name (%s) without insert', async (_label, name) => {
    const { sut, insertStub } = makeSut();

    await expect(sut.execute(makeValidParams({ name }))).rejects.toBeInstanceOf(
      InvalidNameError,
    );
    expect(insertStub.insert).not.toHaveBeenCalled();
  });

  it("stores 'Google  Ads' as 'Google Ads' with nameKey 'google ads'", async () => {
    const { sut, insertStub } = makeSut();

    await sut.execute(makeValidParams({ name: 'Google  Ads' }));

    expect(insertStub.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Google Ads',
        nameKey: 'google ads',
      }),
    );
  });

  it("stores nameKey 'verão' for 'Verão'", async () => {
    const { sut, insertStub } = makeSut();

    await sut.execute(makeValidParams({ name: 'Verão' }));

    expect(insertStub.insert).toHaveBeenCalledWith(
      expect.objectContaining({ nameKey: 'verão' }),
    );
  });

  it('assigns position from nextPosition and opens one interval at createdAt', async () => {
    jest.useFakeTimers();
    const now = new Date('2026-03-01T10:00:00.000Z');
    jest.setSystemTime(now);

    const { sut, nextPositionStub, insertStub } = makeSut();

    await sut.execute(makeValidParams({ categoryId: 'canal' }));

    expect(nextPositionStub.nextPosition).toHaveBeenCalledWith('canal');
    const snapshot = insertStub.insert.mock.calls[0]?.[0];
    expect(snapshot?.position).toBe(1);
    expect(snapshot?.intervals).toEqual([{ from: now, to: null }]);
    expect(snapshot?.createdAt).toEqual(now);
  });

  it('uses nextPosition result when it returns 4', async () => {
    const { sut, nextPositionStub, insertStub } = makeSut();
    nextPositionStub.nextPosition.mockResolvedValue(4);

    await sut.execute(makeValidParams());

    expect(insertStub.insert).toHaveBeenCalledWith(
      expect.objectContaining({ position: 4 }),
    );
  });

  it('rejects a taken nameKey without insert', async () => {
    const { sut, availabilityStub, insertStub } = makeSut();
    availabilityStub.existsByNameKey.mockResolvedValue(true);

    await expect(
      sut.execute(makeValidParams({ name: 'INSTAGRAM' })),
    ).rejects.toBeInstanceOf(IndicationOriginNameTakenError);

    expect(availabilityStub.existsByNameKey).toHaveBeenCalledWith({
      categoryId: 'canal',
      nameKey: 'instagram',
    });
    expect(insertStub.insert).not.toHaveBeenCalled();
  });

  it('allows the same nameKey in another category when the port says free', async () => {
    const { sut, availabilityStub, insertStub } = makeSut();

    await sut.execute(
      makeValidParams({ categoryId: 'campanha', name: 'Verão' }),
    );

    expect(availabilityStub.existsByNameKey).toHaveBeenCalledWith({
      categoryId: 'campanha',
      nameKey: 'verão',
    });
    expect(insertStub.insert).toHaveBeenCalled();
  });

  it('propagates IndicationOriginNameTakenError from insert without wrapping', async () => {
    const { sut, insertStub } = makeSut();
    insertStub.insert.mockRejectedValue(new IndicationOriginNameTakenError());

    await expect(sut.execute(makeValidParams())).rejects.toBeInstanceOf(
      IndicationOriginNameTakenError,
    );
  });

  it('returns the entity id matching hex24 and passed to insert', async () => {
    const { sut, insertStub } = makeSut();

    const result = await sut.execute(makeValidParams());

    expect(result.id).toMatch(HEX_24);
    const inserted = insertStub.insert.mock.calls[0]?.[0];
    expect(result.id).toBe(inserted?.id);
  });

  it('depends on name policy, next position, and insert ports only', () => {
    const { namePolicy, nextPositionStub, insertStub } = makeStubs();
    const sut = new CreateIndicationOriginUsecase(
      namePolicy,
      nextPositionStub,
      insertStub,
    );
    expect(sut).toBeInstanceOf(CreateIndicationOriginUsecase);
  });
});
