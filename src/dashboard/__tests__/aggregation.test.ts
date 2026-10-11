import { budgetedVsIncome, categoryTotalsForMonth, monthlyTotals, last6MonthsExpense } from '../aggregation';
import type { Budget } from '../../budgets/types';
import type { Category, Transaction } from '../../transactions/types';

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 10000,
    category: 'Food',
    date: localDate(2026, 9, 15),
    note: null,
    createdAt: localDate(2026, 9, 15),
    updatedAt: localDate(2026, 9, 15),
    ...overrides,
  };
}

describe('categoryTotalsForMonth', () => {
  it('sums expense transactions per category for the given month', () => {
    const transactions = [
      tx({ id: '1', category: 'Food', amount: 20000, date: localDate(2026, 9, 1) }),
      tx({ id: '2', category: 'Food', amount: 15000, date: localDate(2026, 9, 20) }),
      tx({ id: '3', category: 'Transport', amount: 8000, date: localDate(2026, 9, 10) }),
      tx({ id: '4', category: 'Food', amount: 99999, date: localDate(2026, 8, 1) }), // wrong month
      tx({ id: '5', category: 'Food', type: 'income', amount: 99999, date: localDate(2026, 9, 1) }), // income
    ];

    const totals = categoryTotalsForMonth(transactions, localDate(2026, 9, 17));

    expect(totals).toEqual({ Food: 35000, Transport: 8000 });
  });

  it('returns an empty object for no transactions', () => {
    expect(categoryTotalsForMonth([], localDate(2026, 9, 17))).toEqual({});
  });
});

describe('monthlyTotals', () => {
  it('sums income and expense separately for the given month', () => {
    const transactions = [
      tx({ id: '1', type: 'expense', amount: 20000, date: localDate(2026, 9, 1) }),
      tx({ id: '2', type: 'expense', amount: 15000, date: localDate(2026, 9, 20) }),
      tx({ id: '3', type: 'income', amount: 500000, date: localDate(2026, 9, 5) }),
      tx({ id: '4', type: 'income', amount: 99999, date: localDate(2026, 8, 5) }), // wrong month
    ];

    const totals = monthlyTotals(transactions, localDate(2026, 9, 17));

    expect(totals).toEqual({ income: 500000, expense: 35000 });
  });
});

describe('last6MonthsExpense', () => {
  it('returns 6 months of expense totals ending at the reference month, oldest first', () => {
    const transactions = [
      tx({ id: '1', amount: 10000, date: localDate(2026, 4, 15) }),
      tx({ id: '2', amount: 20000, date: localDate(2026, 6, 15) }),
      tx({ id: '3', amount: 30000, date: localDate(2026, 9, 15) }),
    ];

    const result = last6MonthsExpense(transactions, localDate(2026, 9, 17));

    expect(result).toHaveLength(6);
    expect(result.map((m) => m.month)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(result.map((m) => m.total)).toEqual([10000, 0, 20000, 0, 0, 30000]);
  });
});

// Spec 009 2026-10-11 amendment (#15), criteria 18-20 and 23.
describe('budgetedVsIncome', () => {
  const when = localDate(2026, 10, 1);
  function budget(category: string, monthlyLimit: number): Budget {
    return { id: `b-${category}`, category, monthlyLimit, createdAt: when, updatedAt: when };
  }
  function sub(name: string, parentCategory: string | null): Category {
    return { id: `c-${name}`, name, type: 'expense', parentCategory };
  }

  it('totals every limit and returns the rounded share of income (criterion 18)', () => {
    const result = budgetedVsIncome(
      [budget('Rent', 900000), budget('Food', 450000), budget('Transport', 150000), budget('Fun', 120000), budget('Health', 108000)],
      [],
      2400000
    );
    expect(result).toEqual({ totalBudgeted: 1728000, income: 2400000, percent: 72 });
  });

  it('rounds to the nearest whole percent', () => {
    expect(budgetedVsIncome([budget('Food', 1)], [], 3).percent).toBe(33);
    expect(budgetedVsIncome([budget('Food', 2)], [], 3).percent).toBe(67);
  });

  it('does not clamp above 100% (criterion 19)', () => {
    expect(budgetedVsIncome([budget('Rent', 1728000)], [], 1540000).percent).toBe(112);
  });

  it('returns a null percent when income is zero, never Infinity or NaN (criterion 20)', () => {
    const result = budgetedVsIncome([budget('Rent', 900000)], [], 0);
    expect(result).toEqual({ totalBudgeted: 900000, income: 0, percent: null });
  });

  it('returns zero budgeted with no budgets', () => {
    expect(budgetedVsIncome([], [], 500000)).toEqual({ totalBudgeted: 0, income: 500000, percent: 0 });
  });

  it('counts only the parent limit when a subcategory is also budgeted (criterion 23)', () => {
    const categories = [sub('Restaurants', 'Food')];
    const result = budgetedVsIncome(
      [budget('Food', 450000), budget('Restaurants', 100000), budget('Rent', 900000)],
      categories,
      2000000
    );
    expect(result.totalBudgeted).toBe(1350000);
  });

  it('still counts a subcategory budget whose parent has no budget', () => {
    const categories = [sub('Restaurants', 'Food')];
    const result = budgetedVsIncome([budget('Restaurants', 100000)], categories, 1000000);
    expect(result.totalBudgeted).toBe(100000);
  });
});
