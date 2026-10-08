export type IndicationCategoryId = 'canal' | 'campanha' | 'amigo';

export type IndicationCategory =
  | { id: 'canal'; name: 'Canal'; order: 1; holdsOrigins: true }
  | { id: 'campanha'; name: 'Campanha'; order: 2; holdsOrigins: true }
  | { id: 'amigo'; name: 'Amigo'; order: 3; holdsOrigins: false };

const CATEGORIES: readonly IndicationCategory[] = Object.freeze([
  Object.freeze({
    id: 'canal',
    name: 'Canal',
    order: 1,
    holdsOrigins: true,
  }),
  Object.freeze({
    id: 'campanha',
    name: 'Campanha',
    order: 2,
    holdsOrigins: true,
  }),
  Object.freeze({
    id: 'amigo',
    name: 'Amigo',
    order: 3,
    holdsOrigins: false,
  }),
]);

export const IndicationCategories = {
  list(): IndicationCategory[] {
    return CATEGORIES.slice();
  },

  find(id: string): IndicationCategory | undefined {
    return CATEGORIES.find((category) => category.id === id);
  },
};
