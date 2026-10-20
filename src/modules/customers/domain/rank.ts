export const RANKS = ['BRONZE', 'SILVER', 'GOLD'] as const;
export type Rank = (typeof RANKS)[number];
export const INITIAL_RANK: Rank = 'BRONZE';
