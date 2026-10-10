import type { MonthRef } from '../dashboard/monthBounds';
import { startOfNextMonth } from '../dashboard/monthBounds';
import type { Transaction } from '../transactions/types';
import type { Debt } from './types';

// Spec 008 — deliberately simple: balance / minimum payment, no
// amortization or interest compounding. See the spec's Requirements
// section for why.
export function monthsToPayoff(currentBalance: number, minimumPayment: number): number {
  if (currentBalance <= 0) {
    return 0;
  }
  if (minimumPayment <= 0) {
    return Infinity;
  }
  return Math.ceil(currentBalance / minimumPayment);
}

export function percentPaid(originalAmount: number, currentBalance: number): number {
  if (originalAmount <= 0) {
    return 0;
  }
  if (currentBalance <= 0) {
    return 1;
  }
  return (originalAmount - currentBalance) / originalAmount;
}

// Spec 008 criterion 8 — balance at the end of `month`, reconstructed by
// adding back the logged payments (expense transactions in the debt's
// category) dated after it. Approximate by design: direct balance edits
// aren't logged. `null` = the debt didn't exist yet.
export function debtBalanceAsOf(debt: Debt, transactions: Transaction[], month: MonthRef): number | null {
  const end = startOfNextMonth(month);
  if (debt.createdAt >= end) {
    return null;
  }
  const paidLater = transactions
    .filter((t) => t.type === 'expense' && t.category === debt.name && t.date >= end)
    .reduce((sum, t) => sum + t.amount, 0);
  return debt.currentBalance + paidLater;
}
