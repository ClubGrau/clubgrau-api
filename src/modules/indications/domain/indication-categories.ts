import {
  IndicationCategoryDoesNotHoldOriginsError,
  IndicationCategoryUnknownError,
} from './errors/indication.errors';

export type IndicationCategoryId = 'canal' | 'campanha' | 'amigo';

export type IndicationCategory =
  | { id: 'canal'; name: 'Canal'; order: 1; holdsOrigins: true }
  | { id: 'campanha'; name: 'Campanha'; order: 2; holdsOrigins: true }
  | { id: 'amigo'; name: 'Amigo'; order: 3; holdsOrigins: false };

export type IndicationCategoryHoldingOrigins = Extract<
  IndicationCategory,
  { holdsOrigins: true }
>;

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

  requireHoldingOrigins(id: string): IndicationCategoryHoldingOrigins {
    const category = CATEGORIES.find((item) => item.id === id);
    if (category === undefined) {
      throw new IndicationCategoryUnknownError();
    }
    if (category.holdsOrigins === false) {
      throw new IndicationCategoryDoesNotHoldOriginsError();
    }
    return category;
  },
};
