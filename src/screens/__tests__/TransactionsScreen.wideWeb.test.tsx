import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { Transaction } from '../../transactions/types';
import { useTransactionsStore } from '../../transactions/store';
import { TransactionsScreen } from '../TransactionsScreen';

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));

jest.mock('../../theme/useWideWeb', () => ({
  useWideWeb: () => true,
}));

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    transactions: [] as Transaction[],
    categories: [],
    addTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    addCategory: jest.fn(),
    ...overrides,
  };
  (useTransactionsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
  return state;
}

const EXISTING: Transaction = {
  id: 'tx-1',
  type: 'expense',
  amount: 45000,
  category: 'Food',
  date: new Date('2026-09-15'),
  note: 'Groceries',
  createdAt: new Date('2026-09-15'),
  updatedAt: new Date('2026-09-15'),
};

describe('TransactionsScreen (wide web, spec 006)', () => {
  it('shows the list and an empty-state prompt when no form is open (criterion 2)', async () => {
    mockStore({ transactions: [EXISTING] });
    await render(<TransactionsScreen />);

    expect(screen.getByTestId('transaction-row-tx-1')).toBeTruthy();
    expect(screen.getByTestId('wide-empty-state')).toBeTruthy();
    expect(screen.queryByTestId('transaction-form')).toBeNull();
  });

  it('keeps the list visible next to the form once it opens (criterion 3)', async () => {
    mockStore({ transactions: [EXISTING] });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));

    expect(screen.getByTestId('transaction-row-tx-1')).toBeTruthy();
    expect(screen.getByTestId('transaction-form')).toBeTruthy();
    expect(screen.queryByTestId('wide-empty-state')).toBeNull();
  });

  it('renders Amount and Date in the same row (criterion 4)', async () => {
    mockStore();
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));

    const row = screen.getByTestId('amount-date-row');
    expect(within(row).getByTestId('amount-input')).toBeTruthy();
    expect(within(row).getByTestId('date-input')).toBeTruthy();
  });

  it('still creates a transaction correctly from the split layout', async () => {
    const store = mockStore();
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));
    await fireEvent.changeText(screen.getByTestId('amount-input'), '45000');
    await fireEvent.press(screen.getByTestId('category-chip-Food'));
    await fireEvent.press(screen.getByTestId('save-transaction-button'));

    expect(store.addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', amount: 45000, category: 'Food' })
    );
  });
});
