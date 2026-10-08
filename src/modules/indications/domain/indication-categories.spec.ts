import {
  InvalidUniqueEntityIdError,
  UniqueEntityId,
} from '@shared/domain/value-object';
import { IndicationCategories } from './indication-categories';

describe('IndicationCategories', () => {
  it('lists Canal, Campanha, and Amigo in that order', () => {
    const categories = IndicationCategories.list();

    expect(categories.map((category) => category.id)).toEqual([
      'canal',
      'campanha',
      'amigo',
    ]);
    expect(categories.map((category) => category.order)).toEqual([1, 2, 3]);
    expect(categories.map((category) => category.name)).toEqual([
      'Canal',
      'Campanha',
      'Amigo',
    ]);
  });

  it('lets only Canal and Campanha hold origins', () => {
    expect(
      IndicationCategories.list().map((category) => category.holdsOrigins),
    ).toEqual([true, true, false]);
  });

  it.each(['canal', 'campanha', 'amigo'] as const)('finds %s', (id) => {
    const category = IndicationCategories.list().find((item) => item.id === id);

    expect(IndicationCategories.find(id)).toEqual(category);
  });

  it('returns nothing for an unknown id', () => {
    expect(IndicationCategories.find('instagram')).toBeUndefined();
    expect(IndicationCategories.find('')).toBeUndefined();
  });

  it('treats category ids as codes, not entity ids', () => {
    expect(() => new UniqueEntityId('canal')).toThrow(
      InvalidUniqueEntityIdError,
    );
  });
});
