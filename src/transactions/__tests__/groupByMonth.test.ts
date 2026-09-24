import type { Transaction } from '../types';
import { groupTransactionsByMonth } from '../groupByMonth';

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

describe('groupTransactionsByMonth (spec 002 2026-09-25 amendment, criterion 12)', () => {
  it('groups transactions into per-month sections, most recent first', () => {
    // Deliberately already date-descending, matching the store's own
    // sort order (spec 002 criterion 5) — the function relies on this,
    // it does not sort internally.
    const transactions = [
      tx({ id: 't1', date: localDate(2026, 9, 22) }),
      tx({ id: 't2', date: localDate(2026, 9, 15) }),
      tx({ id: 't3', date: localDate(2026, 8, 30) }),
      tx({ id: 't4', date: localDate(2026, 7, 10) }),
    ];

    const groups = groupTransactionsByMonth(transactions);

    expect(groups.map((g) => [g.year, g.month])).toEqual([
      [2026, 9],
      [2026, 8],
      [2026, 7],
    ]);
    expect(groups[0].transactions.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(groups[1].transactions.map((t) => t.id)).toEqual(['t3']);
    expect(groups[2].transactions.map((t) => t.id)).toEqual(['t4']);
  });

  it("sums only expense transactions for a month's totalSpent, not income", () => {
    const transactions = [
      tx({ id: 't1', type: 'income', amount: 1450000, date: localDate(2026, 9, 23) }),
      tx({ id: 't2', type: 'expense', amount: 4500, date: localDate(2026, 9, 22) }),
      tx({ id: 't3', type: 'expense', amount: 12300, date: localDate(2026, 9, 21) }),
    ];

    const groups = groupTransactionsByMonth(transactions);

    expect(groups).toHaveLength(1);
    expect(groups[0].totalSpent).toBe(16800);
  });

  it('preserves within-month order exactly as given', () => {
    const transactions = [
      tx({ id: 't1', date: localDate(2026, 9, 22) }),
      tx({ id: 't2', date: localDate(2026, 9, 20) }),
      tx({ id: 't3', date: localDate(2026, 9, 18) }),
    ];

    const groups = groupTransactionsByMonth(transactions);

    expect(groups[0].transactions.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('returns an empty array for no transactions', () => {
    expect(groupTransactionsByMonth([])).toEqual([]);
  });
});
