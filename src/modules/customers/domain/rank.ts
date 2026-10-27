export const RANKS = ['BRONZE', 'SILVER', 'GOLD'] as const;
export type Rank = (typeof RANKS)[number];
export const INITIAL_RANK: Rank = 'BRONZE';

export function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value);
}
