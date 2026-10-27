import { INITIAL_RANK, RANKS, isRank } from './rank';

describe('Rank', () => {
  it('lists BRONZE, SILVER, and GOLD in that order', () => {
    expect([...RANKS]).toEqual(['BRONZE', 'SILVER', 'GOLD']);
  });

  it('starts new customers at BRONZE', () => {
    expect(INITIAL_RANK).toBe('BRONZE');
  });

  it.each(['BRONZE', 'SILVER', 'GOLD'])('accepts %s as a rank', (value) => {
    expect(isRank(value)).toBe(true);
  });

  it.each(['bronze', 'PLATINUM', ''])('refuses %p as a rank', (value) => {
    expect(isRank(value)).toBe(false);
  });
});
