import type { Transaction } from '../types';
import { rankCategories } from '../rankCategories';

const NOW = new Date(2026, 9, 14); // 14 Oct 2026, local

function daysAgo(n: number): Date {
  return new Date(2026, 9, 14 - n);
}

function tx(category: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    type: 'expense',
    amount: 10000,
    category,
    date: daysAgo(1),
    note: null,
    cardId: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...overrides,
  };
}

const NAMES = ['Food', 'Transport', 'Housing', 'Gym'];

describe('rankCategories (spec 002, criteria 18–20)', () => {
  it('orders names by transaction count, most first (criterion 18)', () => {
    const txs = [tx('Gym'), tx('Gym'), tx('Gym'), tx('Transport'), tx('Transport'), tx('Housing')];
    expect(rankCategories(NAMES, txs, 'expense', NOW)).toEqual([
      'Gym',
      'Transport',
      'Housing',
      'Food',
    ]);
  });

  it('ignores transactions older than 90 days (criterion 19)', () => {
    const txs = [tx('Food', { date: daysAgo(91) }), tx('Food', { date: daysAgo(120) }), tx('Gym')];
    expect(rankCategories(NAMES, txs, 'expense', NOW)).toEqual([
      'Gym',
      'Food',
      'Transport',
      'Housing',
    ]);
  });

  it('counts a transaction exactly 90 days old (criterion 19)', () => {
    const txs = [tx('Gym', { date: daysAgo(90) })];
    expect(rankCategories(NAMES, txs, 'expense', NOW)[0]).toBe('Gym');
  });

  it('only counts transactions of the requested type (criterion 19)', () => {
    const txs = [tx('Gym', { type: 'income' }), tx('Gym', { type: 'income' }), tx('Housing')];
    expect(rankCategories(NAMES, txs, 'expense', NOW)[0]).toBe('Housing');
    expect(rankCategories(NAMES, txs, 'income', NOW)[0]).toBe('Gym');
  });

  it('counts transactions, not amounts (criterion 19)', () => {
    const txs = [tx('Housing', { amount: 900000 }), tx('Gym'), tx('Gym')];
    expect(rankCategories(NAMES, txs, 'expense', NOW)[0]).toBe('Gym');
  });

  it('keeps input order for ties and for never-used names (criterion 20)', () => {
    const txs = [tx('Housing'), tx('Gym')];
    expect(rankCategories(NAMES, txs, 'expense', NOW)).toEqual([
      'Housing',
      'Gym',
      'Food',
      'Transport',
    ]);
  });

  it('returns the input order unchanged with no transactions (criterion 20)', () => {
    expect(rankCategories(NAMES, [], 'expense', NOW)).toEqual(NAMES);
  });

  it('does not mutate its input', () => {
    const names = [...NAMES];
    rankCategories(names, [tx('Gym')], 'expense', NOW);
    expect(names).toEqual(NAMES);
  });
});
