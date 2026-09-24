import type { Transaction } from './types';

export type TransactionMonthGroup = {
  year: number;
  month: number; // 1-indexed
  totalSpent: number; // whole CLP, expense transactions only — matches the Dashboard's "Spend" language, not net
  transactions: Transaction[];
};

// Spec 002's 2026-09-25 amendment — buckets an already date-descending
// list (the store's own sort, criterion 5) into per-month sections,
// most recent month first. Deliberately does NOT sort internally: it
// relies on the caller's precondition, same as spec 009's
// last6MonthsExpense/categoryTotalsForMonth do about their inputs.
export function groupTransactionsByMonth(transactions: Transaction[]): TransactionMonthGroup[] {
  const groups: TransactionMonthGroup[] = [];
  for (const t of transactions) {
    const year = t.date.getFullYear();
    const month = t.date.getMonth() + 1;
    let group = groups.find((g) => g.year === year && g.month === month);
    if (!group) {
      group = { year, month, totalSpent: 0, transactions: [] };
      groups.push(group);
    }
    group.transactions.push(t);
    if (t.type === 'expense') {
      group.totalSpent += t.amount;
    }
  }
  return groups;
}
