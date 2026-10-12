import { IndicationOriginNameTakenError } from '../errors/indication.errors';
import type { IndicationOriginNameAvailabilityPort } from '../ports/indication-origin-name-availability.port';
import { IndicationOriginNamePolicy } from './indication-origin-name.policy';

const makeStubs = () => ({
  availabilityStub: {
    existsByNameKey: jest.fn().mockResolvedValue(false),
  } satisfies IndicationOriginNameAvailabilityPort,
});

const makeSut = () => {
  const { availabilityStub } = makeStubs();
  const sut = new IndicationOriginNamePolicy(availabilityStub);
  return { sut, availabilityStub };
};

describe('IndicationOriginNamePolicy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeInstanceOf(IndicationOriginNamePolicy);
  });

  it('resolves when the name key is free and does not send exceptOriginId', async () => {
    const { sut, availabilityStub } = makeSut();

    await expect(
      sut.ensureAvailable({ categoryId: 'canal', nameKey: 'instagram' }),
    ).resolves.toBeUndefined();

    expect(availabilityStub.existsByNameKey).toHaveBeenCalledTimes(1);
    const [query] = availabilityStub.existsByNameKey.mock.calls[0];
    expect(query).toEqual({ categoryId: 'canal', nameKey: 'instagram' });
    expect(query).not.toHaveProperty('exceptOriginId');
    expect(query).not.toHaveProperty('active');
    expect(query).not.toHaveProperty('intervals');
  });

  it('throws IndicationOriginNameTakenError when the name key is taken', async () => {
    const { sut, availabilityStub } = makeSut();
    availabilityStub.existsByNameKey.mockResolvedValueOnce(true);

    await expect(
      sut.ensureAvailable({ categoryId: 'campanha', nameKey: 'verão' }),
    ).rejects.toBeInstanceOf(IndicationOriginNameTakenError);
  });

  it('forwards exceptOriginId when the caller provides it', async () => {
    const { sut, availabilityStub } = makeSut();

    await sut.ensureAvailable({
      categoryId: 'canal',
      nameKey: 'instagram',
      exceptOriginId: '507f1f77bcf86cd799439011',
    });

    const [query] = availabilityStub.existsByNameKey.mock.calls[0];
    expect(query).toEqual({
      categoryId: 'canal',
      nameKey: 'instagram',
      exceptOriginId: '507f1f77bcf86cd799439011',
    });
    expect(query).not.toHaveProperty('active');
    expect(query).not.toHaveProperty('intervals');
  });
});
