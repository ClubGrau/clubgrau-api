import { CheckLivenessQuery } from './check-liveness.query';

describe('CheckLivenessQuery', () => {
  it('should return status ok', async () => {
    const sut = new CheckLivenessQuery();

    const result = await sut.execute();

    expect(result).toEqual({ status: 'ok' });
  });
});
