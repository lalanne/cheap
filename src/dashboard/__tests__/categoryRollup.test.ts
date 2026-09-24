import type { Category } from '../../transactions/types';
import { rollUpCategoryTotals, subcategoryTotalsFor } from '../categoryRollup';

const FOOD_SUBCATEGORIES: Category[] = [
  { id: 'c1', name: 'Groceries', type: 'both', parentCategory: 'Food' },
  { id: 'c2', name: 'Uber Eats', type: 'both', parentCategory: 'Food' },
  { id: 'c3', name: 'Gym', type: 'both', parentCategory: null },
];

describe('rollUpCategoryTotals (spec 011 criterion 3)', () => {
  it('folds a subcategory total into its parent and drops the subcategory key', () => {
    const totals = { Food: 100, Groceries: 220, 'Uber Eats': 130, Housing: 350 };

    expect(rollUpCategoryTotals(totals, FOOD_SUBCATEGORIES)).toEqual({ Food: 450, Housing: 350 });
  });

  it('leaves top-level categories (no parent) untouched', () => {
    const totals = { Gym: 50, Housing: 350 };

    expect(rollUpCategoryTotals(totals, FOOD_SUBCATEGORIES)).toEqual({ Gym: 50, Housing: 350 });
  });

  it('treats a subcategory whose parent no longer exists as its own top-level entry (criterion 6)', () => {
    const orphan: Category[] = [{ id: 'c9', name: 'Old Sub', type: 'both', parentCategory: 'Deleted Parent' }];
    const totals = { 'Old Sub': 75 };

    expect(rollUpCategoryTotals(totals, orphan)).toEqual({ 'Old Sub': 75 });
  });

  it('rolls up into a custom (non-starter) top-level parent too', () => {
    const categories: Category[] = [
      { id: 'p1', name: 'Gym', type: 'both', parentCategory: null },
      { id: 'p2', name: 'Yoga Classes', type: 'both', parentCategory: 'Gym' },
    ];
    const totals = { Gym: 20000, 'Yoga Classes': 15000 };

    expect(rollUpCategoryTotals(totals, categories)).toEqual({ Gym: 35000 });
  });
});

describe('subcategoryTotalsFor (spec 011 criterion 4)', () => {
  it('returns only the direct subcategories of the given parent, unrolled', () => {
    const totals = { Food: 100, Groceries: 220, 'Uber Eats': 130, Housing: 350 };

    expect(subcategoryTotalsFor(totals, FOOD_SUBCATEGORIES, 'Food')).toEqual({
      Groceries: 220,
      'Uber Eats': 130,
    });
  });

  it('returns an empty object for a category with no subcategories', () => {
    expect(subcategoryTotalsFor({ Housing: 350 }, FOOD_SUBCATEGORIES, 'Housing')).toEqual({});
  });
});
