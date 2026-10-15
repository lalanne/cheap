import type { Budget } from '../budgets/types';
import type { Category } from '../transactions/types';
import { colors } from '../theme/tokens';
import { budgetSpendTotals } from './categoryRollup';

export type GaugeSegment = {
  category: string;
  color: string;
  limit: number;
  spent: number;
  arcLength: number;
  arcOffset: number;
  fillRatio: number;
  fillLength: number;
  over: boolean;
};

export type GaugeResult = {
  segments: GaugeSegment[];
  totalBudgeted: number;
  totalSpent: number;
  unbudgeted: number;
};

// Spec 009 2026-10-15 amendment (#36), criteria 24-27. The budget gauge is
// a semicircle built like the donut (stacked dashed <Circle>s), but each
// arc is sized by its category's share of the total *limit*, not of spend,
// and a second, shorter dash on top shows how much of that limit is used.
//
// `totals` is the raw per-category spend for the viewed month
// (categoryTotalsForMonth). A budget on a subcategory whose parent is also
// budgeted is skipped — the parent's rolled-up spend already includes it
// (the same rule as budgetedVsIncome, criterion 23).
export function computeGaugeSegments({
  budgets,
  categories,
  totals,
  radius,
}: {
  budgets: Budget[];
  categories: Category[];
  totals: Record<string, number>;
  radius: number;
}): GaugeResult {
  const budgeted = new Set(budgets.map((b) => b.category));
  const counted = budgets
    .filter((b) => {
      const parent = categories.find((c) => c.name === b.category)?.parentCategory ?? null;
      return !(parent !== null && budgeted.has(parent));
    })
    .sort((a, b) => b.monthlyLimit - a.monthlyLimit || a.category.localeCompare(b.category));

  const spendLookup = budgetSpendTotals(totals, categories);
  const totalBudgeted = counted.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const halfCircumference = Math.PI * radius;

  let cumulative = 0;
  const segments = counted.map((b, index): GaugeSegment => {
    const spent = spendLookup[b.category] ?? 0;
    const arcLength = (b.monthlyLimit / totalBudgeted) * halfCircumference;
    const fillRatio = Math.min(spent / b.monthlyLimit, 1);
    const segment: GaugeSegment = {
      category: b.category,
      color: colors.chart[index % colors.chart.length],
      limit: b.monthlyLimit,
      spent,
      arcLength,
      arcOffset: -cumulative,
      fillRatio,
      fillLength: fillRatio * arcLength,
      over: spent > b.monthlyLimit,
    };
    cumulative += arcLength;
    return segment;
  });

  const totalSpent = segments.reduce((sum, s) => sum + s.spent, 0);
  const rawTotal = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  return { segments, totalBudgeted, totalSpent, unbudgeted: rawTotal - totalSpent };
}

// The list under the gauge: most-used first so over-budget rows are always
// visible above "Show more" (criterion 28). Ties alphabetical.
export function rankGaugeRows(segments: GaugeSegment[]): GaugeSegment[] {
  return [...segments].sort(
    (a, b) => b.spent / b.limit - a.spent / a.limit || a.category.localeCompare(b.category),
  );
}
