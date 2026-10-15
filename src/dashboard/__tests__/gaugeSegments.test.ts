import { computeGaugeSegments, rankGaugeRows } from '../gaugeSegments';
import type { Budget } from '../../budgets/types';
import type { Category } from '../../transactions/types';

const when = new Date(2026, 9, 1);
function budget(category: string, monthlyLimit: number): Budget {
  return { id: `b-${category}`, category, monthlyLimit, createdAt: when, updatedAt: when };
}
function cat(name: string, parentCategory: string | null = null): Category {
  return { id: `c-${name}`, name, type: 'expense', parentCategory };
}

const radius = 100;
const halfCircumference = Math.PI * radius;

// Spec 009 2026-10-15 amendment (#36), criteria 24-27.
describe('computeGaugeSegments', () => {
  it('sizes arcs by limit share, summing to the half circumference, largest first (criterion 24)', () => {
    const { segments } = computeGaugeSegments({
      budgets: [budget('Fun', 100000), budget('Rent', 300000)],
      categories: [],
      totals: {},
      radius,
    });

    expect(segments.map((s) => s.category)).toEqual(['Rent', 'Fun']);
    expect(segments[0].arcLength).toBeCloseTo(0.75 * halfCircumference, 5);
    expect(segments[0].arcOffset).toBeCloseTo(0, 5);
    expect(segments[1].arcLength).toBeCloseTo(0.25 * halfCircumference, 5);
    expect(segments[1].arcOffset).toBeCloseTo(-segments[0].arcLength, 5);
    expect(segments.reduce((sum, s) => sum + s.arcLength, 0)).toBeCloseTo(halfCircumference, 5);
  });

  it('breaks limit ties alphabetically and uses spec 003 chart colors in order (criterion 24)', () => {
    const { segments } = computeGaugeSegments({
      budgets: [budget('B', 1000), budget('A', 1000)],
      categories: [],
      totals: {},
      radius,
    });
    expect(segments.map((s) => s.category)).toEqual(['A', 'B']);
    expect(segments.map((s) => s.color)).toEqual(['#2a78d6', '#eb6834']);
  });

  it('skips a child budget whose ancestor is budgeted, counting the ancestor once (criterion 24)', () => {
    const { segments, totalBudgeted } = computeGaugeSegments({
      budgets: [budget('Food', 400000), budget('Restaurants', 150000), budget('Rent', 600000)],
      categories: [cat('Food'), cat('Restaurants', 'Food'), cat('Rent')],
      totals: {},
      radius,
    });
    expect(segments.map((s) => s.category).sort()).toEqual(['Food', 'Rent']);
    expect(totalBudgeted).toBe(1000000);
  });

  it('fills each arc by min(spent / limit, 1) and rolls subcategory spend into the parent (criterion 25)', () => {
    const { segments, totalSpent, totalBudgeted } = computeGaugeSegments({
      budgets: [budget('Food', 400000), budget('Rent', 600000)],
      categories: [cat('Food'), cat('Restaurants', 'Food'), cat('Rent')],
      totals: { Food: 100000, Restaurants: 100000, Rent: 150000 },
      radius,
    });
    const food = segments.find((s) => s.category === 'Food')!;
    expect(food.spent).toBe(200000);
    expect(food.fillRatio).toBeCloseTo(0.5, 5);
    expect(food.fillLength).toBeCloseTo(0.5 * food.arcLength, 5);
    expect(food.over).toBe(false);
    expect(totalSpent).toBe(350000);
    expect(totalBudgeted).toBe(1000000);
  });

  it('caps the fill at the segment but keeps real spent and the unclamped total when over (criterion 26)', () => {
    const { segments, totalSpent } = computeGaugeSegments({
      budgets: [budget('Fun', 200), budget('Rent', 800)],
      categories: [],
      totals: { Fun: 205, Rent: 100 },
      radius,
    });
    const fun = segments.find((s) => s.category === 'Fun')!;
    expect(fun.spent).toBe(205);
    expect(fun.fillRatio).toBe(1);
    expect(fun.fillLength).toBeCloseTo(fun.arcLength, 5);
    expect(fun.over).toBe(true);
    expect(totalSpent).toBe(305);
  });

  it('keeps unbudgeted spend out of the arcs and the center total, reporting it separately (criterion 27)', () => {
    const { segments, totalSpent, unbudgeted } = computeGaugeSegments({
      budgets: [budget('Rent', 800)],
      categories: [cat('Food'), cat('Restaurants', 'Food')],
      totals: { Rent: 500, Food: 70, Restaurants: 30, Misc: 20 },
      radius,
    });
    expect(segments).toHaveLength(1);
    expect(totalSpent).toBe(500);
    expect(unbudgeted).toBe(120);
  });

  it('returns no segments and zero totals without budgets (criterion 29)', () => {
    expect(
      computeGaugeSegments({ budgets: [], categories: [], totals: { Food: 10 }, radius }),
    ).toEqual({ segments: [], totalBudgeted: 0, totalSpent: 0, unbudgeted: 10 });
  });
});

describe('rankGaugeRows (criterion 28)', () => {
  it('orders by spent / limit descending so over-budget rows come first, ties alphabetical', () => {
    const { segments } = computeGaugeSegments({
      budgets: [budget('A', 100), budget('B', 100), budget('C', 100), budget('D', 100)],
      categories: [],
      totals: { A: 50, B: 150, C: 50, D: 0 },
      radius,
    });
    expect(rankGaugeRows(segments).map((s) => s.category)).toEqual(['B', 'A', 'C', 'D']);
  });
});
