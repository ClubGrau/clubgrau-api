import { INITIAL_RANK, RANKS } from './rank';

describe('Rank', () => {
  it('lists BRONZE, SILVER, and GOLD in that order', () => {
    expect([...RANKS]).toEqual(['BRONZE', 'SILVER', 'GOLD']);
  });

  it('starts new customers at BRONZE', () => {
    expect(INITIAL_RANK).toBe('BRONZE');
  });
});
