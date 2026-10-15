import { computeBudgetBar, rankBudgetRows } from '../budgetBar';
import type { Budget } from '../../budgets/types';
import type { Category } from '../../transactions/types';

const when = new Date(2026, 9, 1);
function budget(category: string, monthlyLimit: number): Budget {
  return { id: `b-${category}`, category, monthlyLimit, createdAt: when, updatedAt: when };
}
function cat(name: string, parentCategory: string | null = null): Category {
  return { id: `c-${name}`, name, type: 'expense', parentCategory };
}

// Spec 009 2026-10-15 amendment (#36), option C, criteria 24-27.
describe('computeBudgetBar', () => {
  it('sizes blocks by limit share, summing to 1, largest first (criterion 24)', () => {
    const { blocks } = computeBudgetBar({
      budgets: [budget('Fun', 100000), budget('Rent', 300000)],
      categories: [],
      totals: {},
    });

    expect(blocks.map((b) => b.category)).toEqual(['Rent', 'Fun']);
    expect(blocks[0].share).toBeCloseTo(0.75, 5);
    expect(blocks[1].share).toBeCloseTo(0.25, 5);
    expect(blocks.reduce((sum, b) => sum + b.share, 0)).toBeCloseTo(1, 5);
  });

  it('breaks limit ties alphabetically and uses spec 003 chart colors in order (criterion 24)', () => {
    const { blocks } = computeBudgetBar({
      budgets: [budget('B', 1000), budget('A', 1000)],
      categories: [],
      totals: {},
    });
    expect(blocks.map((b) => b.category)).toEqual(['A', 'B']);
    expect(blocks.map((b) => b.color)).toEqual(['#2a78d6', '#eb6834']);
  });

  it('skips a child budget whose ancestor is budgeted, counting the ancestor once (criterion 24)', () => {
    const { blocks, totalBudgeted } = computeBudgetBar({
      budgets: [budget('Food', 400000), budget('Restaurants', 150000), budget('Rent', 600000)],
      categories: [cat('Food'), cat('Restaurants', 'Food'), cat('Rent')],
      totals: {},
    });
    expect(blocks.map((b) => b.category).sort()).toEqual(['Food', 'Rent']);
    expect(totalBudgeted).toBe(1000000);
  });

  it('fills each block by min(spent / limit, 1) and rolls subcategory spend into the parent (criterion 25)', () => {
    const { blocks, totalSpent, totalBudgeted } = computeBudgetBar({
      budgets: [budget('Food', 400000), budget('Rent', 600000)],
      categories: [cat('Food'), cat('Restaurants', 'Food'), cat('Rent')],
      totals: { Food: 100000, Restaurants: 100000, Rent: 150000 },
    });
    const food = blocks.find((b) => b.category === 'Food')!;
    expect(food.spent).toBe(200000);
    expect(food.fillRatio).toBeCloseTo(0.5, 5);
    expect(food.over).toBe(false);
    expect(totalSpent).toBe(350000);
    expect(totalBudgeted).toBe(1000000);
  });

  it('caps the fill at the block but keeps real spent and the unclamped total when over (criterion 26)', () => {
    const { blocks, totalSpent } = computeBudgetBar({
      budgets: [budget('Fun', 200), budget('Rent', 800)],
      categories: [],
      totals: { Fun: 205, Rent: 100 },
    });
    const fun = blocks.find((b) => b.category === 'Fun')!;
    expect(fun.spent).toBe(205);
    expect(fun.fillRatio).toBe(1);
    expect(fun.over).toBe(true);
    expect(fun.overBy).toBe(5);
    expect(totalSpent).toBe(305);
  });

  it('keeps unbudgeted spend out of the bar and the summary total, reporting it separately (criterion 27)', () => {
    const { blocks, totalSpent, unbudgeted } = computeBudgetBar({
      budgets: [budget('Rent', 800)],
      categories: [cat('Food'), cat('Restaurants', 'Food')],
      totals: { Rent: 500, Food: 70, Restaurants: 30, Misc: 20 },
    });
    expect(blocks).toHaveLength(1);
    expect(totalSpent).toBe(500);
    expect(unbudgeted).toBe(120);
  });

  it('returns no blocks and zero totals without budgets (criterion 29)', () => {
    expect(computeBudgetBar({ budgets: [], categories: [], totals: { Food: 10 } })).toEqual({
      blocks: [],
      totalBudgeted: 0,
      totalSpent: 0,
      unbudgeted: 10,
    });
  });
});

describe('rankBudgetRows (criterion 28)', () => {
  it('orders by spent / limit descending so over-budget rows come first, ties alphabetical', () => {
    const { blocks } = computeBudgetBar({
      budgets: [budget('A', 100), budget('B', 100), budget('C', 100), budget('D', 100)],
      categories: [],
      totals: { A: 50, B: 150, C: 50, D: 0 },
    });
    expect(rankBudgetRows(blocks).map((b) => b.category)).toEqual(['B', 'A', 'C', 'D']);
  });
});
