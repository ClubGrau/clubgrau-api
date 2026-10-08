export interface NextIndicationOriginPositionPort {
  nextPosition(categoryId: 'canal' | 'campanha'): Promise<number>;
}
