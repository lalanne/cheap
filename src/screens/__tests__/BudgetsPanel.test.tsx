import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Budget } from '../../budgets/types';
import { useBudgetsStore } from '../../budgets/store';
import { useTransactionsStore } from '../../transactions/store';
import { BudgetsPanel } from '../BudgetsPanel';

jest.mock('../../budgets/store', () => ({
  useBudgetsStore: jest.fn(),
}));

// BudgetsPanel also reads the category list from the transactions store
// — mocked for the same reason TransactionsScreen.test.tsx mocks it: the
// real module pulls in the native Firestore repos, which Jest can't load.
jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    budgets: [] as Budget[],
    setBudget: jest.fn(),
    deleteBudget: jest.fn(),
    ...overrides,
  };
  (useBudgetsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
  (useTransactionsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { categories: unknown[] }) => unknown) => selector({ categories: [] })
  );
  return state;
}

const EXISTING: Budget = {
  id: 'b-1',
  category: 'Food',
  monthlyLimit: 250000,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
};

describe('BudgetsPanel (spec 009 amendment: Manage tab, not its own screen)', () => {
  it('renders as a panel, not a top-level Screen', async () => {
    mockStore();
    await render(<BudgetsPanel />);

    expect(screen.getByTestId('budgets-panel')).toBeTruthy();
  });

  it('opens the add-budget form and sets a new budget (criterion 1)', async () => {
    const store = mockStore();
    await render(<BudgetsPanel />);

    await fireEvent.press(screen.getByTestId('add-budget-button'));
    await fireEvent.press(screen.getByTestId('budget-category-chip-Food'));
    await fireEvent.changeText(screen.getByTestId('budget-amount-input'), '250000');
    await fireEvent.press(screen.getByTestId('save-budget-button'));

    expect(store.setBudget).toHaveBeenCalledWith('Food', 250000);
  });

  it('rejects an invalid amount without calling the store', async () => {
    const store = mockStore();
    await render(<BudgetsPanel />);

    await fireEvent.press(screen.getByTestId('add-budget-button'));
    await fireEvent.press(screen.getByTestId('budget-category-chip-Food'));
    await fireEvent.changeText(screen.getByTestId('budget-amount-input'), '1500.50');
    await fireEvent.press(screen.getByTestId('save-budget-button'));

    expect(store.setBudget).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number in pesos — no decimals or symbols.')).toBeTruthy();
  });

  it('edits an existing budget in place, prefilled (criterion 2)', async () => {
    const store = mockStore({ budgets: [EXISTING] });
    await render(<BudgetsPanel />);

    await fireEvent.press(screen.getByTestId('budget-row-b-1'));
    expect(screen.getByTestId('budget-amount-input').props.value).toBe('250000');

    await fireEvent.changeText(screen.getByTestId('budget-amount-input'), '300000');
    await fireEvent.press(screen.getByTestId('save-budget-button'));

    expect(store.setBudget).toHaveBeenCalledWith('Food', 300000);
  });

  it('deletes a budget (criterion 5)', async () => {
    const store = mockStore({ budgets: [EXISTING] });
    await render(<BudgetsPanel />);

    await fireEvent.press(screen.getByTestId('delete-budget-b-1'));

    expect(store.deleteBudget).toHaveBeenCalledWith('b-1');
  });

  it('shows an empty state when no budgets are set', async () => {
    mockStore({ budgets: [] });
    await render(<BudgetsPanel />);

    expect(screen.getByTestId('budgets-empty-state')).toBeTruthy();
  });
});
