import { GetIndicationCatalogResultDto } from '@modules/indications/application/dtos/get-indication-catalog.dto';
import { GetIndicationCatalogPort } from '@modules/indications/application/ports/inbound/get-indication-catalog.port';
import { GetIndicationCatalogController } from './get-indication-catalog.controller';

const catalog: GetIndicationCatalogResultDto = {
  categories: [
    {
      id: 'canal',
      name: 'Canal',
      holdsOrigins: true,
      origins: [
        {
          id: '507f1f77bcf86cd799439011',
          categoryId: 'canal',
          name: 'Facebook',
          active: true,
        },
      ],
    },
    {
      id: 'campanha',
      name: 'Campanha',
      holdsOrigins: true,
      origins: [],
    },
    {
      id: 'amigo',
      name: 'Amigo',
      holdsOrigins: false,
      origins: [],
    },
  ],
};

const makeStubs = () => ({
  getIndicationCatalogStub: {
    execute: jest.fn().mockResolvedValue(catalog),
  } satisfies GetIndicationCatalogPort,
});

const makeSut = (): SutTypes => {
  const { getIndicationCatalogStub } = makeStubs();
  const sut = new GetIndicationCatalogController(getIndicationCatalogStub);
  return { sut, getIndicationCatalogStub };
};

type SutTypes = {
  sut: GetIndicationCatalogController;
  getIndicationCatalogStub: GetIndicationCatalogPort;
};

describe('GetIndicationCatalogController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(GetIndicationCatalogController);
  });

  it('should call execute with no args', async () => {
    const { sut, getIndicationCatalogStub } = makeSut();
    const executeSpy = jest.spyOn(getIndicationCatalogStub, 'execute');

    await sut.handle({ actorId: 'actor-1' });

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith();
  });

  it('should return 200 with the catalog categories', async () => {
    const { sut } = makeSut();

    const response = await sut.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ data: catalog });
  });

  it('should return 500 if the port throws an unexpected error', async () => {
    const { sut, getIndicationCatalogStub } = makeSut();
    jest
      .spyOn(getIndicationCatalogStub, 'execute')
      .mockRejectedValue(new Error('GetIndicationCatalogPort error'));

    const response = await sut.handle({});

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'GetIndicationCatalogPort error',
    });
  });
});
