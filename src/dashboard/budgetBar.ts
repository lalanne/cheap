import type { Budget } from '../budgets/types';
import type { Category } from '../transactions/types';
import { colors } from '../theme/tokens';
import { budgetSpendTotals } from './categoryRollup';

export type BudgetBlock = {
  category: string;
  color: string;
  limit: number;
  spent: number;
  share: number;
  fillRatio: number;
  over: boolean;
  overBy: number;
};

export type BudgetBarResult = {
  blocks: BudgetBlock[];
  totalBudgeted: number;
  totalSpent: number;
  unbudgeted: number;
};

// Spec 009 2026-10-15 amendment (#36), option C, criteria 24-27. The
// budget bar is one horizontal row of blocks, one per budgeted category,
// each block's width its share of the total *limit*, filled by how much of
// that limit is spent.
//
// `totals` is the raw per-category spend for the viewed month
// (categoryTotalsForMonth). A budget on a subcategory whose parent is also
// budgeted is skipped — the parent's rolled-up spend already includes it
// (the same rule as budgetedVsIncome, criterion 23).
export function computeBudgetBar({
  budgets,
  categories,
  totals,
}: {
  budgets: Budget[];
  categories: Category[];
  totals: Record<string, number>;
}): BudgetBarResult {
  const budgeted = new Set(budgets.map((b) => b.category));
  const counted = budgets
    .filter((b) => {
      const parent = categories.find((c) => c.name === b.category)?.parentCategory ?? null;
      return !(parent !== null && budgeted.has(parent));
    })
    .sort((a, b) => b.monthlyLimit - a.monthlyLimit || a.category.localeCompare(b.category));

  const spendLookup = budgetSpendTotals(totals, categories);
  const totalBudgeted = counted.reduce((sum, b) => sum + b.monthlyLimit, 0);

  const blocks = counted.map((b, index): BudgetBlock => {
    const spent = spendLookup[b.category] ?? 0;
    return {
      category: b.category,
      color: colors.chart[index % colors.chart.length],
      limit: b.monthlyLimit,
      spent,
      share: b.monthlyLimit / totalBudgeted,
      fillRatio: Math.min(spent / b.monthlyLimit, 1),
      over: spent > b.monthlyLimit,
      overBy: Math.max(spent - b.monthlyLimit, 0),
    };
  });

  const totalSpent = blocks.reduce((sum, b) => sum + b.spent, 0);
  const rawTotal = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  return { blocks, totalBudgeted, totalSpent, unbudgeted: rawTotal - totalSpent };
}

// The list under the bar: most-used first so over-budget rows are always
// visible above "Show more" (criterion 28). Ties alphabetical.
export function rankBudgetRows(blocks: BudgetBlock[]): BudgetBlock[] {
  return [...blocks].sort(
    (a, b) => b.spent / b.limit - a.spent / a.limit || a.category.localeCompare(b.category),
  );
}
