import {
  availableOf,
  cardBalanceAsOf,
  creditCardBalance,
  creditCardStatus,
  usedPercent,
} from '../creditCardMath';
import type { CreditCardPayment } from '../types';
import type { Transaction } from '../../transactions/types';

let nextTxId = 1;
function expenseTx(
  amount: number,
  cardId: string | null,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: `tx-${nextTxId++}`,
    type: 'expense',
    amount,
    category: 'Groceries',
    date: new Date('2026-09-01'),
    note: null,
    cardId,
    createdAt: new Date('2026-09-01'),
    updatedAt: new Date('2026-09-01'),
    ...overrides,
  };
}

let nextPaymentId = 1;
function payment(amount: number, cardId: string): CreditCardPayment {
  return {
    id: `p-${nextPaymentId++}`,
    cardId,
    amount,
    date: new Date('2026-09-10'),
    note: null,
    createdAt: new Date('2026-09-10'),
  };
}

describe('creditCardBalance (spec 013 criterion 3 — a live sum, not stored)', () => {
  it('is the sum of expenses tagged with the card minus payments against it', () => {
    const transactions = [
      expenseTx(45000, 'card-1'),
      expenseTx(12000, 'card-1'),
      expenseTx(9000, 'card-2'),
    ];
    const payments = [payment(20000, 'card-1')];

    expect(creditCardBalance('card-1', transactions, payments)).toBe(37000);
  });

  it('ignores transactions and payments belonging to a different card', () => {
    const transactions = [expenseTx(45000, 'card-2')];
    const payments = [payment(1000, 'card-2')];

    expect(creditCardBalance('card-1', transactions, payments)).toBe(0);
  });

  it('ignores transactions with no card (cardId null)', () => {
    const transactions = [expenseTx(45000, null)];

    expect(creditCardBalance('card-1', transactions, [])).toBe(0);
  });

  it('ignores income even if it somehow carries the card id', () => {
    const transactions = [expenseTx(45000, 'card-1', { type: 'income' })];

    expect(creditCardBalance('card-1', transactions, [])).toBe(0);
  });

  it('is 0 with no matching transactions or payments', () => {
    expect(creditCardBalance('card-1', [], [])).toBe(0);
  });

  it('reflects an edited or deleted tagged transaction automatically — no separate update needed', () => {
    const original = expenseTx(45000, 'card-1');
    const edited = { ...original, amount: 30000 };

    expect(creditCardBalance('card-1', [original], [])).toBe(45000);
    expect(creditCardBalance('card-1', [edited], [])).toBe(30000);
    expect(creditCardBalance('card-1', [], [])).toBe(0);
  });
});

describe('availableOf / usedPercent', () => {
  it('computes available = limit − balance, negative when over the limit', () => {
    expect(availableOf(1240000, 2000000)).toBe(760000);
    expect(availableOf(2120000, 2000000)).toBe(-120000);
  });

  it('computes usedPercent as a whole number, above 100 when over the limit', () => {
    expect(usedPercent(1240000, 2000000)).toBe(62);
    expect(usedPercent(2120000, 2000000)).toBe(106);
    expect(usedPercent(0, 2000000)).toBe(0);
  });

  it('treats a zero limit as 0% instead of dividing by zero', () => {
    expect(usedPercent(500000, 0)).toBe(0);
  });
});

describe('creditCardStatus (criterion 4 — no "unused" tier, exact boundaries)', () => {
  const LIMIT = 2000000;

  it('is in-use at zero and just below 75%', () => {
    expect(creditCardStatus(0, LIMIT)).toBe('in-use');
    expect(creditCardStatus(1499999, LIMIT)).toBe('in-use');
  });

  it('is high from exactly 75% up to and including the limit', () => {
    expect(creditCardStatus(1500000, LIMIT)).toBe('high');
    expect(creditCardStatus(2000000, LIMIT)).toBe('high');
  });

  it('is over-limit above the limit — a purchase there is accepted, never blocked', () => {
    expect(creditCardStatus(2000001, LIMIT)).toBe('over-limit');
  });
});

describe('cardBalanceAsOf (spec 013 criterion 10 — balance at the end of a month)', () => {
  const aug = { year: 2026, month: 8 };

  it('sums only tagged expenses and payments dated on or before the month end', () => {
    const transactions = [
      expenseTx(45000, 'card-1', { date: new Date(2026, 7, 31, 23, 59) }),
      expenseTx(12000, 'card-1', { date: new Date(2026, 8, 1, 0, 0) }),
      expenseTx(9000, 'card-2', { date: new Date(2026, 7, 5) }),
      expenseTx(7000, null, { date: new Date(2026, 7, 6) }),
      expenseTx(5000, 'card-1', { type: 'income', date: new Date(2026, 7, 7) }),
    ];
    const payments = [
      { ...payment(20000, 'card-1'), date: new Date(2026, 7, 20) },
      { ...payment(8000, 'card-1'), date: new Date(2026, 8, 3) },
    ];
    expect(cardBalanceAsOf('card-1', transactions, payments, aug)).toBe(25000);
  });

  it('is null when the card has no activity dated on or before the month', () => {
    const transactions = [expenseTx(12000, 'card-1', { date: new Date(2026, 8, 2) })];
    expect(cardBalanceAsOf('card-1', transactions, [], aug)).toBeNull();
    expect(cardBalanceAsOf('card-1', [], [], aug)).toBeNull();
  });

  it('equals creditCardBalance when nothing is dated after the month', () => {
    const transactions = [expenseTx(45000, 'card-1', { date: new Date(2026, 7, 2) })];
    const payments = [{ ...payment(5000, 'card-1'), date: new Date(2026, 7, 9) }];
    expect(cardBalanceAsOf('card-1', transactions, payments, aug)).toBe(
      creditCardBalance('card-1', transactions, payments),
    );
  });
});
