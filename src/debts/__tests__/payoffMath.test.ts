import { debtBalanceAsOf, monthsToPayoff, percentPaid } from '../payoffMath';
import type { Debt } from '../types';
import type { Transaction } from '../../transactions/types';

describe('monthsToPayoff (spec 008 criterion 4)', () => {
  it('divides balance by minimum payment, rounded up', () => {
    expect(monthsToPayoff(1200000, 100000)).toBe(12);
    expect(monthsToPayoff(1250000, 100000)).toBe(13); // rounds up, not down
  });

  it('is 0 when the balance is already 0 (edge case)', () => {
    expect(monthsToPayoff(0, 100000)).toBe(0);
  });

  it('is Infinity when the minimum payment is 0 and balance is not (never pays off)', () => {
    expect(monthsToPayoff(1000, 0)).toBe(Infinity);
  });
});

describe('percentPaid (spec 008 criterion 4)', () => {
  it('computes the fraction of the original amount already paid', () => {
    expect(percentPaid(2000000, 1200000)).toBeCloseTo(0.4);
  });

  it('is 1 (100%) when the balance is 0 (edge case)', () => {
    expect(percentPaid(2000000, 0)).toBe(1);
  });

  it('is 0 when the original amount is 0 (nothing to divide by)', () => {
    expect(percentPaid(0, 0)).toBe(0);
  });
});

describe('debtBalanceAsOf (spec 008 criterion 8 — balance at the end of a month)', () => {
  const aug = { year: 2026, month: 8 };
  const debt: Debt = {
    id: 'd1',
    name: 'Credit Card',
    originalAmount: 2000000,
    currentBalance: 1200000,
    minimumPayment: 100000,
    interestRate: null,
    createdAt: new Date(2026, 0, 15),
    updatedAt: new Date(2026, 9, 1),
  };
  let n = 1;
  function pay(
    amount: number,
    date: Date,
    category = 'Credit Card',
    type: 'expense' | 'income' = 'expense',
  ): Transaction {
    return {
      id: `t${n++}`,
      type,
      amount,
      category,
      date,
      note: null,
      cardId: null,
      createdAt: date,
      updatedAt: date,
    };
  }

  it('adds back payments logged after the month ends', () => {
    const txs = [pay(100000, new Date(2026, 8, 5)), pay(50000, new Date(2026, 9, 2))];
    expect(debtBalanceAsOf(debt, txs, aug)).toBe(1350000);
  });

  it('ignores payments on or before the last day of the month (boundary: Aug 31 23:59 in, Sep 1 00:00 out)', () => {
    const inside = pay(70000, new Date(2026, 7, 31, 23, 59));
    const outside = pay(30000, new Date(2026, 8, 1, 0, 0));
    expect(debtBalanceAsOf(debt, [inside, outside], aug)).toBe(1230000);
  });

  it("ignores other categories and income in this debt's category", () => {
    const txs = [
      pay(40000, new Date(2026, 8, 5), 'Groceries'),
      pay(40000, new Date(2026, 8, 6), 'Credit Card', 'income'),
    ];
    expect(debtBalanceAsOf(debt, txs, aug)).toBe(1200000);
  });

  it('is currentBalance when there are no payments after the month', () => {
    expect(debtBalanceAsOf(debt, [], { year: 2026, month: 10 })).toBe(1200000);
  });

  it('is null when the debt was created after the month ended', () => {
    expect(debtBalanceAsOf(debt, [], { year: 2025, month: 12 })).toBeNull();
  });
});
