export type IndicationOriginInterval = {
  from: Date;
  to: Date | null;
};

export type IndicationOriginSnapshot = {
  id: string;
  categoryId: 'canal' | 'campanha';
  name: string;
  nameKey: string;
  position: number;
  createdAt: Date;
  intervals: IndicationOriginInterval[];
};
