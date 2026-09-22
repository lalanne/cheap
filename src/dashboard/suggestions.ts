import type { Budget } from '../budgets/types';
import type { Debt } from '../debts/types';
import { monthsToPayoff } from '../debts/payoffMath';

export type BudgetOverrunSuggestion = {
  id: string;
  kind: 'budget-overrun';
  category: string;
  spend: number;
  limit: number;
  percent: number;
};

export type DebtPaceSuggestion = {
  id: string;
  kind: 'debt-pace';
  debtName: string;
  monthsAtCurrentPace: number;
  monthsAtDoublePace: number;
};

export type SavingsRateSuggestion = {
  id: string;
  kind: 'savings-rate';
  thisMonthRate: number;
  lastMonthRate: number;
};

export type Suggestion = BudgetOverrunSuggestion | DebtPaceSuggestion | SavingsRateSuggestion;

type ComputeSuggestionsInput = {
  budgets: Budget[];
  categorySpend: Record<string, number>;
  debts: Debt[];
  thisMonth: { income: number; expense: number };
  lastMonth: { income: number; expense: number };
};

// Spec 009 — rule-based, not AI-generated (see the spec's Decisions
// section for why). Three independent rules, combined and returned in a
// stable order (overruns first, worst first; then debt pace; then
// savings rate) — the screen renders them as-is, no further sorting.
export function computeSuggestions({
  budgets,
  categorySpend,
  debts,
  thisMonth,
  lastMonth,
}: ComputeSuggestionsInput): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const overruns: BudgetOverrunSuggestion[] = budgets
    .map((b) => {
      const spend = categorySpend[b.category] ?? 0;
      const percent = b.monthlyLimit > 0 ? spend / b.monthlyLimit : 0;
      return { id: `budget-${b.id}`, kind: 'budget-overrun' as const, category: b.category, spend, limit: b.monthlyLimit, percent };
    })
    .filter((s) => s.percent > 1)
    .sort((a, b) => b.percent - a.percent);
  suggestions.push(...overruns);

  for (const d of debts) {
    if (d.minimumPayment <= 0) {
      continue;
    }
    suggestions.push({
      id: `debt-${d.id}`,
      kind: 'debt-pace',
      debtName: d.name,
      monthsAtCurrentPace: monthsToPayoff(d.currentBalance, d.minimumPayment),
      monthsAtDoublePace: monthsToPayoff(d.currentBalance, d.minimumPayment * 2),
    });
  }

  if (thisMonth.income > 0) {
    suggestions.push({
      id: 'savings-rate',
      kind: 'savings-rate',
      thisMonthRate: (thisMonth.income - thisMonth.expense) / thisMonth.income,
      lastMonthRate: lastMonth.income > 0 ? (lastMonth.income - lastMonth.expense) / lastMonth.income : 0,
    });
  }

  return suggestions;
}
