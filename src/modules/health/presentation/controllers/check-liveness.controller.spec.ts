import { CheckLivenessPort } from '@modules/health/application/ports/inbound/check-liveness.port';
import { CheckLivenessController } from './check-liveness.controller';

const makeStubs = () => ({
  checkLivenessStub: {
    execute: jest.fn().mockResolvedValue({ status: 'ok' }),
  } satisfies CheckLivenessPort,
});

const makeSut = () => {
  const { checkLivenessStub } = makeStubs();
  const sut = new CheckLivenessController(checkLivenessStub);
  return { sut, checkLivenessStub };
};

describe('CheckLivenessController', () => {
  it('should return 200 with liveness data', async () => {
    const { sut, checkLivenessStub } = makeSut();

    const response = await sut.handle({});

    expect(checkLivenessStub.execute).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      statusCode: 200,
      body: { data: { status: 'ok' } },
    });
  });

  it('should return 500 when the query throws', async () => {
    const { sut, checkLivenessStub } = makeSut();
    (checkLivenessStub.execute as jest.Mock).mockRejectedValue(
      new Error('boom'),
    );

    const response = await sut.handle({});

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'boom' });
  });
});
