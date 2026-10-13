import type { Category } from '../../transactions/types';
import { budgetSpendTotals, rollUpCategoryTotals, subcategoryTotalsFor } from '../categoryRollup';

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

describe('budgetSpendTotals (spec 011 criterion 9)', () => {
  it('keeps a subcategory under its own name while its parent stays rolled up', () => {
    const totals = { Food: 100, Groceries: 220, 'Uber Eats': 130 };

    expect(budgetSpendTotals(totals, FOOD_SUBCATEGORIES)).toEqual({
      Food: 450,
      Groceries: 220,
      'Uber Eats': 130,
    });
  });

  it('omits a subcategory with no spend this month rather than inventing a 0', () => {
    expect(budgetSpendTotals({ Food: 100 }, FOOD_SUBCATEGORIES)).toEqual({ Food: 100 });
  });

  it('matches rollUpCategoryTotals for top-level categories and dangling parents', () => {
    const orphan: Category[] = [{ id: 'c9', name: 'Old Sub', type: 'both', parentCategory: 'Deleted Parent' }];

    expect(budgetSpendTotals({ Gym: 50, 'Old Sub': 75 }, [...FOOD_SUBCATEGORIES, ...orphan])).toEqual({
      Gym: 50,
      'Old Sub': 75,
    });
  });

  it('works for a subcategory of a custom top-level parent', () => {
    const custom: Category[] = [
      { id: 'p1', name: 'Home', type: 'both', parentCategory: null },
      { id: 's1', name: 'Gastos comunes', type: 'both', parentCategory: 'Home' },
    ];

    expect(budgetSpendTotals({ Home: 10, 'Gastos comunes': 90 }, custom)).toEqual({
      Home: 100,
      'Gastos comunes': 90,
    });
  });
});
