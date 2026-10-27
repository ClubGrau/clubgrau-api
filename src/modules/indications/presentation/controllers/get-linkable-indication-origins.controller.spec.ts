import { GetLinkableIndicationOriginsResultDto } from '@modules/indications/application/dtos/get-linkable-indication-origins.dto';
import { GetLinkableIndicationOriginsPort } from '@modules/indications/application/ports/inbound/get-linkable-indication-origins.port';
import { GetLinkableIndicationOriginsController } from './get-linkable-indication-origins.controller';

const origins: GetLinkableIndicationOriginsResultDto = {
  origins: [
    {
      id: '507f1f77bcf86cd799439011',
      categoryId: 'canal',
      name: 'Instagram',
    },
  ],
};

const makeStubs = (
  result: GetLinkableIndicationOriginsResultDto = origins,
) => ({
  getLinkableIndicationOriginsStub: {
    execute: jest.fn().mockResolvedValue(result),
  } satisfies GetLinkableIndicationOriginsPort,
});

const makeSut = (result?: GetLinkableIndicationOriginsResultDto): SutTypes => {
  const { getLinkableIndicationOriginsStub } = makeStubs(result);
  const sut = new GetLinkableIndicationOriginsController(
    getLinkableIndicationOriginsStub,
  );
  return { sut, getLinkableIndicationOriginsStub };
};

type SutTypes = {
  sut: GetLinkableIndicationOriginsController;
  getLinkableIndicationOriginsStub: GetLinkableIndicationOriginsPort;
};

describe('GetLinkableIndicationOriginsController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetLinkableIndicationOriginsController);
  });

  it('should ignore the request and call execute with no args', async () => {
    const { sut, getLinkableIndicationOriginsStub } = makeSut();
    const executeSpy = jest.spyOn(getLinkableIndicationOriginsStub, 'execute');

    await sut.handle({ actorId: 'actor-1' });

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith();
  });

  it('should return 200 with the linkable origins', async () => {
    const { sut } = makeSut();

    const response = await sut.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: origins });
  });

  it('should return 200 when execute resolves an empty list', async () => {
    const empty: GetLinkableIndicationOriginsResultDto = { origins: [] };
    const { sut } = makeSut(empty);

    const response = await sut.handle({ actorId: 'ignored' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: empty });
  });

  it('should return 500 if the port throws an unexpected error', async () => {
    const { sut, getLinkableIndicationOriginsStub } = makeSut();
    jest
      .spyOn(getLinkableIndicationOriginsStub, 'execute')
      .mockRejectedValue(new Error('GetLinkableIndicationOriginsPort error'));

    const response = await sut.handle({});

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'GetLinkableIndicationOriginsPort error',
    });
  });
});
