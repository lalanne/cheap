import type { Transaction } from '../transactions/types';

function isSameMonth(date: Date, reference: Date): boolean {
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

// Per-category expense totals for the calendar month containing
// `reference` — feeds both the "Where it went" donut and the budget
// progress bars (which already have their own version of this in
// computeCategorySpend; this one covers every category at once instead
// of a single one, for the dashboard's use).
export function categoryTotalsForMonth(
  transactions: Transaction[],
  reference: Date = new Date()
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || !isSameMonth(t.date, reference)) {
      continue;
    }
    totals[t.category] = (totals[t.category] ?? 0) + t.amount;
  }
  return totals;
}

export function monthlyTotals(
  transactions: Transaction[],
  reference: Date = new Date()
): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!isSameMonth(t.date, reference)) {
      continue;
    }
    if (t.type === 'income') {
      income += t.amount;
    } else {
      expense += t.amount;
    }
  }
  return { income, expense };
}

export type MonthExpense = { year: number; month: number; total: number };

// The 6 calendar months ending at `reference`'s month, oldest first —
// for the trend chart. `month` is 1-indexed (matches how the rest of
// this app already talks about months, e.g. computeCategorySpend's
// callers), not JS's 0-indexed getMonth().
export function last6MonthsExpense(transactions: Transaction[], reference: Date = new Date()): MonthExpense[] {
  const months: MonthExpense[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1, total: 0 });
  }

  for (const t of transactions) {
    if (t.type !== 'expense') {
      continue;
    }
    const match = months.find((m) => m.year === t.date.getFullYear() && m.month === t.date.getMonth() + 1);
    if (match) {
      match.total += t.amount;
    }
  }

  return months;
}
