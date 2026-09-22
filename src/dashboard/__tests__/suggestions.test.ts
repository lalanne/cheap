import { computeSuggestions } from '../suggestions';
import type { Budget } from '../../budgets/types';
import type { Debt } from '../../debts/types';

function budget(overrides: Partial<Budget>): Budget {
  return {
    id: 'b-1',
    category: 'Food',
    monthlyLimit: 250000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function debt(overrides: Partial<Debt>): Debt {
  return {
    id: 'd-1',
    name: 'Credit Card',
    originalAmount: 2000000,
    currentBalance: 1200000,
    minimumPayment: 100000,
    interestRate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('computeSuggestions — budget overrun rule (spec 009 criterion 2)', () => {
  it('flags a category over its budget, sorted by how far over', () => {
    const suggestions = computeSuggestions({
      budgets: [budget({ id: 'b-1', category: 'Entertainment', monthlyLimit: 60000 }), budget({ id: 'b-2', category: 'Food', monthlyLimit: 250000 })],
      categorySpend: { Entertainment: 95000, Food: 285000 },
      debts: [],
      thisMonth: { income: 0, expense: 0 },
      lastMonth: { income: 0, expense: 0 },
    });

    const overrunSuggestions = suggestions.filter((s) => s.kind === 'budget-overrun');
    expect(overrunSuggestions).toHaveLength(2);
    // Entertainment is further over (158%) than Food (114%) — sorted first
    expect(overrunSuggestions[0].category).toBe('Entertainment');
    expect(overrunSuggestions[1].category).toBe('Food');
  });

  it('does not flag a category at or under its budget', () => {
    const suggestions = computeSuggestions({
      budgets: [budget({ category: 'Food', monthlyLimit: 250000 })],
      categorySpend: { Food: 250000 },
      debts: [],
      thisMonth: { income: 0, expense: 0 },
      lastMonth: { income: 0, expense: 0 },
    });

    expect(suggestions.filter((s) => s.kind === 'budget-overrun')).toHaveLength(0);
  });
});

describe('computeSuggestions — debt pace rule (spec 009 criterion 3)', () => {
  it('shows current pace and the doubled-payment estimate', () => {
    const suggestions = computeSuggestions({
      budgets: [],
      categorySpend: {},
      debts: [debt({ currentBalance: 1400000, minimumPayment: 100000 })],
      thisMonth: { income: 0, expense: 0 },
      lastMonth: { income: 0, expense: 0 },
    });

    const debtSuggestions = suggestions.filter((s) => s.kind === 'debt-pace');
    expect(debtSuggestions).toHaveLength(1);
    expect(debtSuggestions[0].monthsAtCurrentPace).toBe(14);
    expect(debtSuggestions[0].monthsAtDoublePace).toBe(7);
  });

  it('skips a debt with no minimum payment', () => {
    const suggestions = computeSuggestions({
      budgets: [],
      categorySpend: {},
      debts: [debt({ minimumPayment: 0 })],
      thisMonth: { income: 0, expense: 0 },
      lastMonth: { income: 0, expense: 0 },
    });

    expect(suggestions.filter((s) => s.kind === 'debt-pace')).toHaveLength(0);
  });
});

describe('computeSuggestions — savings rate rule (spec 009 criterion 4)', () => {
  it('compares this month savings rate to last month', () => {
    const suggestions = computeSuggestions({
      budgets: [],
      categorySpend: {},
      debts: [],
      thisMonth: { income: 1800000, expense: 970000 },
      lastMonth: { income: 1800000, expense: 1200000 },
    });

    const savingsSuggestion = suggestions.find((s) => s.kind === 'savings-rate');
    expect(savingsSuggestion).toBeDefined();
    expect(savingsSuggestion?.thisMonthRate).toBeCloseTo((1800000 - 970000) / 1800000);
    expect(savingsSuggestion?.lastMonthRate).toBeCloseTo((1800000 - 1200000) / 1800000);
  });

  it('is absent entirely when this month has zero income', () => {
    const suggestions = computeSuggestions({
      budgets: [],
      categorySpend: {},
      debts: [],
      thisMonth: { income: 0, expense: 50000 },
      lastMonth: { income: 1800000, expense: 1200000 },
    });

    expect(suggestions.find((s) => s.kind === 'savings-rate')).toBeUndefined();
  });
});
