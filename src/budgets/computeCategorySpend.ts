import type { Transaction } from '../transactions/types';

// Spec 007 criterion 3 — actual spend against a budget is computed, not
// stored: the sum of a category's expense transactions dated within the
// same calendar month as `reference` (defaults to now). Pure function so
// spec 009's dashboard (and this spec's own tests) can call it without a
// new Firestore query — the store already holds every synced transaction.
export function computeCategorySpend(
  transactions: Transaction[],
  category: string,
  reference: Date = new Date()
): number {
  const year = reference.getFullYear();
  const month = reference.getMonth();

  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.category === category &&
        t.date.getFullYear() === year &&
        t.date.getMonth() === month
    )
    .reduce((sum, t) => sum + t.amount, 0);
}
