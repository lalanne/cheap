import { startOfNextMonth, type MonthRef } from '../dashboard/monthBounds';
import type { Transaction } from '../transactions/types';
import type { CreditCardPayment } from './types';

// Spec 013 — a card's balance is a live sum over already-existing data
// (expense transactions tagged with its id, spec 002's 2026-09-29
// amendment) rather than a stored, duplicated figure — see the spec's
// "Why not a separate ledger". Editing or deleting a tagged transaction
// changes the result automatically, with no extra write.
export function creditCardBalance(
  cardId: string,
  transactions: Transaction[],
  payments: CreditCardPayment[],
): number {
  const charged = transactions
    .filter((t) => t.type === 'expense' && t.cardId === cardId)
    .reduce((sum, t) => sum + t.amount, 0);
  const paid = payments.filter((p) => p.cardId === cardId).reduce((sum, p) => sum + p.amount, 0);
  return charged - paid;
}

// Spec 013 criterion 10 — the same live sum restricted to items dated before
// the end of `month`; `null` when the card has no activity by then.
export function cardBalanceAsOf(
  cardId: string,
  transactions: Transaction[],
  payments: CreditCardPayment[],
  month: MonthRef,
): number | null {
  const end = startOfNextMonth(month);
  const txs = transactions.filter((t) => t.date < end);
  const pays = payments.filter((p) => p.date < end);
  const hasActivity =
    txs.some((t) => t.type === 'expense' && t.cardId === cardId) ||
    pays.some((p) => p.cardId === cardId);
  return hasActivity ? creditCardBalance(cardId, txs, pays) : null;
}

export function availableOf(balance: number, limit: number): number {
  return limit - balance;
}

export function usedPercent(balance: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }
  return Math.round((balance / limit) * 100);
}

export type CreditCardStatus = 'in-use' | 'high' | 'over-limit';

const HIGH_NUMERATOR = 3; // 75% = 3/4, compared in integers to keep the
const HIGH_DENOMINATOR = 4; // boundary exact (no float drift at 1.500.000).

// No "unused" tier (unlike the overdraft) — using a card at all is normal,
// not a signal something's gone short; see spec 013's Derived values. A
// purchase that pushes the balance past the limit is accepted, never
// blocked — same stance as spec 012.
export function creditCardStatus(balance: number, limit: number): CreditCardStatus {
  if (balance > limit) {
    return 'over-limit';
  }
  if (balance * HIGH_DENOMINATOR >= limit * HIGH_NUMERATOR) {
    return 'high';
  }
  return 'in-use';
}
