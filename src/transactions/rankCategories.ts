import type { Transaction, TransactionType } from './types';

const WINDOW_DAYS = 90;

// Spec 002's 2026-10-14 amendment (issue #41) — orders category names so
// the ones used most recently come first in the picker. Counts
// transactions (not amounts) of `type` dated within the last 90 days;
// ties and never-used names keep their input order (Array.sort is
// stable), so an account with no history sees today's picker unchanged.
export function rankCategories(
  names: readonly string[],
  transactions: readonly Transaction[],
  type: TransactionType,
  now: Date,
): string[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - WINDOW_DAYS);
  const counts = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== type || t.date < cutoff) continue;
    counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  }
  return [...names].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
}
