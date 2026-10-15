import type { Budget } from '../budgets/types';
import type { Category } from '../transactions/types';

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

// Spec 009 2026-10-15 amendment (#36), option C, criteria 24-27. Skeleton
// only: the failing tests in __tests__/budgetBar.test.ts drive the real
// implementation.
export function computeBudgetBar(_input: {
  budgets: Budget[];
  categories: Category[];
  totals: Record<string, number>;
}): BudgetBarResult {
  throw new Error('not implemented');
}

export function rankBudgetRows(_blocks: BudgetBlock[]): BudgetBlock[] {
  throw new Error('not implemented');
}
