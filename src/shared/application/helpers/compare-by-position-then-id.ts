export type PositionThenIdSortable = {
  id: string;
  position: number;
};

export function compareByPositionThenId(
  a: PositionThenIdSortable,
  b: PositionThenIdSortable,
): number {
  if (a.position !== b.position) {
    return a.position - b.position;
  }
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  return 0;
}
