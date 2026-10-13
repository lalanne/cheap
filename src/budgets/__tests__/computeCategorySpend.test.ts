import { computeCategorySpend } from '../computeCategorySpend';
import type { Transaction } from '../../transactions/types';

// Local-midnight construction (year, monthIndex, day), not a date-only
// ISO string — new Date('2026-09-01') parses as UTC midnight, which
// shifts to the wrong local month/day whenever the machine's timezone is
// behind UTC (a real failure hit writing this test). Production dates
// avoid this the same way: DatePickerField.web.tsx explicitly builds
// `T00:00:00` (local) rather than a bare date string.
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

describe('computeCategorySpend (spec 007 criterion 3)', () => {
  it('sums only expense transactions in the given category and month', () => {
    const transactions = [
      tx({ id: '1', category: 'Food', amount: 20000, date: localDate(2026, 9, 1) }),
      tx({ id: '2', category: 'Food', amount: 15000, date: localDate(2026, 9, 30) }),
      // wrong category
      tx({ id: '3', category: 'Transport', amount: 5000, date: localDate(2026, 9, 10) }),
      // wrong month
      tx({ id: '4', category: 'Food', amount: 99999, date: localDate(2026, 8, 31) }),
      // income, not expense
      tx({
        id: '5',
        category: 'Food',
        type: 'income',
        amount: 99999,
        date: localDate(2026, 9, 10),
      }),
    ];

    const total = computeCategorySpend(transactions, 'Food', localDate(2026, 9, 17));

    expect(total).toBe(35000);
  });

  it('returns 0 for a category with no matching transactions', () => {
    const total = computeCategorySpend([], 'Food', localDate(2026, 9, 17));

    expect(total).toBe(0);
  });
});
